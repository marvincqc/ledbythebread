import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import type { WaitlistEntry, Sku, DeliverySlot, SlotType } from "../../types";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getNextDays(count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

interface ModalItem {
  sku_id: string;
  quantity: number;
}

export default function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create Order modal
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [allSlots, setAllSlots] = useState<DeliverySlot[]>([]);
  const [orderName, setOrderName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [orderAddress, setOrderAddress] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [orderSlot, setOrderSlot] = useState<SlotType | "">("");
  const [orderItems, setOrderItems] = useState<ModalItem[]>([{ sku_id: "", quantity: 1 }]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const modalDates = getNextDays(30);

  useEffect(() => {
    fetchEntries();
    supabase.from("skus").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setSkus((data ?? []) as Sku[]));
  }, []);

  async function fetchEntries() {
    setLoading(true);
    const { data } = await supabase
      .from("slot_waitlist")
      .select("*")
      .order("delivery_date")
      .order("slot_type")
      .order("created_at");
    setEntries((data ?? []) as WaitlistEntry[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("slot_waitlist").delete().eq("id", id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  }

  function openModal(entry: WaitlistEntry) {
    setSelectedEntry(entry);
    setOrderName(entry.name);
    setOrderPhone(entry.phone);
    setOrderEmail(entry.email);
    setOrderAddress("");
    setOrderDate(entry.delivery_date);
    setOrderSlot(entry.slot_type);
    setOrderItems([{ sku_id: skus[0]?.id ?? "", quantity: 1 }]);
    setModalError(null);
    setCreatedOrderId(null);

    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + 30);
    supabase.from("delivery_slots").select("*")
      .gte("delivery_date", today)
      .lte("delivery_date", future.toISOString().split("T")[0])
      .order("delivery_date").order("slot_type")
      .then(({ data }) => setAllSlots((data ?? []) as DeliverySlot[]));
  }

  function closeModal() {
    setSelectedEntry(null);
    setCreatedOrderId(null);
    setModalError(null);
  }

  function addItem() {
    setOrderItems((prev) => [...prev, { sku_id: skus[0]?.id ?? "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ModalItem, value: string | number) {
    setOrderItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  const orderSubtotal = orderItems.reduce((sum, item) => {
    const sku = skus.find((s) => s.id === item.sku_id);
    return sum + (sku?.price ?? 0) * item.quantity;
  }, 0);

  const slotForDate = (date: string, slotType: SlotType) =>
    allSlots.find((s) => s.delivery_date === date && s.slot_type === slotType);

  async function handleCreateOrder() {
    if (!selectedEntry) return;
    if (!orderDate || !orderSlot) { setModalError("Select a delivery date and slot."); return; }
    if (!orderAddress.trim()) { setModalError("Enter a delivery address."); return; }
    if (!orderName.trim() || !orderPhone.trim() || !orderEmail.trim()) {
      setModalError("Name, phone, and email are required.");
      return;
    }

    const validItems = orderItems.filter((i) => i.sku_id && i.quantity > 0);
    if (validItems.length === 0) { setModalError("Add at least one item."); return; }

    const enrichedItems = validItems.map((i) => {
      const sku = skus.find((s) => s.id === i.sku_id);
      return { sku_id: i.sku_id, quantity: i.quantity, unit_price: sku?.price ?? 0 };
    });

    setModalLoading(true);
    setModalError(null);

    const { data, error: fnError } = await callEdgeFunction<{ order_id: string }>("admin-create-order", {
      guest_info: { name: orderName.trim(), phone: orderPhone.trim(), email: orderEmail.trim() },
      delivery_address: orderAddress.trim(),
      delivery_date: orderDate,
      slot_type: orderSlot,
      items: enrichedItems,
      waitlist_entry_id: selectedEntry.id,
    });

    setModalLoading(false);

    if (fnError || !data?.order_id) {
      setModalError(fnError ?? "Failed to create order.");
      return;
    }

    setCreatedOrderId(data.order_id);
    setEntries((prev) => prev.filter((e) => e.id !== selectedEntry.id));
  }

  // Group by date+slot
  const grouped = entries.reduce<Record<string, WaitlistEntry[]>>((acc, e) => {
    const key = `${e.delivery_date}-${e.slot_type}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-heading text-xl font-bold">🍞 Led by the Bread</Link>
          <span className="text-white/50 hidden sm:block">|</span>
          <span className="text-white/80 text-sm hidden sm:block">Admin Panel</span>
        </div>
        <Link to="/admin" className="text-white/80 hover:text-white text-sm border border-white/30 hover:border-white/60 px-3 py-1.5 rounded-button transition-colors">
          ← Dashboard
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl font-bold text-primary">Waitlist</h1>
            <p className="text-text-muted text-sm mt-1">
              {entries.length === 0 ? "No entries" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groupKeys.length === 0 ? (
          <div className="card p-12 text-center">
            <span className="text-5xl block mb-3">✅</span>
            <p className="font-heading text-xl font-semibold text-primary mb-1">Waitlist is empty</p>
            <p className="text-text-muted text-sm">No customers are waiting for a delivery slot.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupKeys.map((key) => {
              const [date, slot] = key.split("-") as [string, SlotType];
              const groupEntries = grouped[key];
              return (
                <div key={key} className="card overflow-hidden">
                  <div className="bg-primary/5 px-5 py-3 border-b border-primary/10 flex items-center gap-3">
                    <span className="text-lg">{slot === "morning" ? "🌅" : "🌇"}</span>
                    <div>
                      <p className="font-semibold text-primary">{formatDate(date)}</p>
                      <p className="text-xs text-text-muted capitalize">{slot} slot · {groupEntries.length} {groupEntries.length === 1 ? "person" : "people"} waiting</p>
                    </div>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {groupEntries.map((entry) => (
                      <div key={entry.id} className="px-5 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-text-main">{entry.name}</p>
                          <p className="text-sm text-text-muted">{entry.phone} · {entry.email}</p>
                          <p className="text-xs text-text-muted mt-0.5">Joined {timeAgo(entry.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => openModal(entry)}
                            className="btn-primary py-1.5 px-3 text-sm"
                          >
                            Create Order
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="text-error/60 hover:text-error border border-error/20 hover:border-error/50 px-3 py-1.5 rounded-button text-sm transition-colors disabled:opacity-50"
                          >
                            {deletingId === entry.id ? "…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Order Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-card w-full max-w-lg my-8 shadow-xl">
            <div className="px-6 py-4 border-b border-primary/10 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-semibold text-primary">Create Order</h2>
                <p className="text-xs text-text-muted mt-0.5">For {selectedEntry.name} · bypasses slot capacity &amp; cut-off</p>
              </div>
              <button onClick={closeModal} className="text-text-muted hover:text-text-main p-1 rounded transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createdOrderId ? (
              <div className="p-6 text-center">
                <span className="text-4xl block mb-3">🎉</span>
                <p className="font-heading text-xl font-semibold text-success mb-1">Order Created!</p>
                <p className="text-text-muted text-sm mb-4">Status set to Confirmed. Waitlist entry removed.</p>
                <a
                  href={`/order/${createdOrderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-block mb-3 text-sm"
                >
                  View Order
                </a>
                <br />
                <button onClick={closeModal} className="text-text-muted hover:text-primary text-sm mt-1 transition-colors">
                  Close
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Contact */}
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Contact Details</p>
                  <div className="space-y-2">
                    <input type="text" value={orderName} onChange={(e) => setOrderName(e.target.value)}
                      placeholder="Full name" className="input text-sm py-2" />
                    <input type="tel" value={orderPhone} onChange={(e) => setOrderPhone(e.target.value)}
                      placeholder="Phone" className="input text-sm py-2" />
                    <input type="email" value={orderEmail} onChange={(e) => setOrderEmail(e.target.value)}
                      placeholder="Email" className="input text-sm py-2" />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Items</p>
                  <div className="space-y-2">
                    {orderItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <select
                          value={item.sku_id}
                          onChange={(e) => updateItem(index, "sku_id", e.target.value)}
                          className="input text-sm py-2 flex-1"
                        >
                          <option value="">Select item…</option>
                          {skus.map((sku) => (
                            <option key={sku.id} value={sku.id}>
                              {sku.name} (S${sku.price.toFixed(2)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                          className="input text-sm py-2 w-16 text-center"
                        />
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="text-error/60 hover:text-error px-2 transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={addItem} className="text-primary text-sm hover:text-primary-dark transition-colors">
                      + Add item
                    </button>
                    <p className="text-sm font-semibold text-primary">Total: S${orderSubtotal.toFixed(2)}</p>
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Delivery Address</p>
                  <textarea
                    value={orderAddress}
                    onChange={(e) => setOrderAddress(e.target.value)}
                    placeholder="Full delivery address"
                    rows={2}
                    className="input text-sm py-2 resize-none"
                  />
                </div>

                {/* Delivery Slot */}
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                    Delivery Slot
                    <span className="ml-2 text-amber-600 normal-case font-normal">Admin override — any slot allowed</span>
                  </p>

                  {/* Date picker */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                    {modalDates.map((date) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => { setOrderDate(date); setOrderSlot(""); }}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-center transition-all text-xs ${
                          orderDate === date
                            ? "bg-primary text-white font-semibold shadow"
                            : "bg-white border border-primary/30 hover:border-primary text-text-muted"
                        }`}
                      >
                        <span className="block font-medium">
                          {new Date(date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short" })}
                        </span>
                        <span className="block font-bold mt-0.5">
                          {new Date(date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Slot toggle */}
                  {orderDate && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["morning", "evening"] as SlotType[]).map((slotType) => {
                        const slot = slotForDate(orderDate, slotType);
                        const isSelected = orderSlot === slotType;
                        const capacityNote = slot
                          ? `${slot.current_orders}/${slot.max_orders} booked${!slot.is_open ? " · closed" : ""}`
                          : "No slot created";
                        return (
                          <button
                            key={slotType}
                            type="button"
                            onClick={() => setOrderSlot(slotType)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              isSelected ? "border-primary bg-primary/5" : "border-primary/20 hover:border-primary/40 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span>{slotType === "morning" ? "🌅" : "🌇"}</span>
                              <span className="font-semibold capitalize text-sm">{slotType}</span>
                              {isSelected && (
                                <span className="ml-auto w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted">{capacityNote}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {modalError && (
                  <div className="bg-error/10 border border-error/20 text-error rounded-lg px-3 py-2.5 text-sm">
                    {modalError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 btn-secondary py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={modalLoading}
                    className="btn-primary py-2.5 text-sm flex-1"
                  >
                    {modalLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating…
                      </span>
                    ) : `Create Confirmed Order · S$${orderSubtotal.toFixed(2)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
