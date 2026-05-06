import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { DeliverySlot, SlotType } from "../../types";

function getNextDays(count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-SG", { weekday: "short" }),
    date: d.toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
  };
}

interface SlotEditModal {
  slot: DeliverySlot;
}

export default function SlotManagement() {
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<SlotEditModal | null>(null);
  const [editMaxOrders, setEditMaxOrders] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dates = getNextDays(14);

  useEffect(() => {
    fetchSlots();
  }, []);

  async function fetchSlots() {
    setLoading(true);
    const { data } = await supabase
      .from("delivery_slots")
      .select("*")
      .in("delivery_date", dates)
      .order("delivery_date", { ascending: true })
      .order("slot_type", { ascending: true });

    if (data) setSlots(data as DeliverySlot[]);
    setLoading(false);
  }

  function getSlot(date: string, slotType: SlotType): DeliverySlot | undefined {
    return slots.find((s) => s.delivery_date === date && s.slot_type === slotType);
  }

  function getSlotColor(slot: DeliverySlot | undefined): string {
    if (!slot) return "bg-gray-100 border-gray-200 text-gray-400";
    if (!slot.is_open) return "bg-gray-100 border-gray-300 text-gray-500";
    if (slot.current_orders >= slot.max_orders)
      return "bg-orange-100 border-orange-300 text-orange-700";
    return "bg-green-100 border-green-300 text-green-700";
  }

  async function toggleSlot(slot: DeliverySlot) {
    const { error } = await supabase
      .from("delivery_slots")
      .update({ is_open: !slot.is_open })
      .eq("id", slot.id);

    if (!error) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, is_open: !slot.is_open } : s
        )
      );
      showMessage("success", `Slot ${slot.is_open ? "closed" : "opened"} successfully.`);
    } else {
      showMessage("error", error.message);
    }
  }

  async function saveSlot() {
    if (!editModal) return;
    const maxOrders = parseInt(editMaxOrders, 10);
    if (isNaN(maxOrders) || maxOrders < 1) {
      showMessage("error", "Max orders must be a positive number.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("delivery_slots")
      .update({ max_orders: maxOrders })
      .eq("id", editModal.slot.id);

    if (!error) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === editModal.slot.id ? { ...s, max_orders: maxOrders } : s
        )
      );
      setEditModal(null);
      showMessage("success", "Slot updated successfully.");
    } else {
      showMessage("error", error.message);
    }
    setSaving(false);
  }

  async function ensureSlot(date: string, slotType: SlotType) {
    const { error } = await supabase.from("delivery_slots").upsert(
      {
        delivery_date: date,
        slot_type: slotType,
        max_orders: 30,
        current_orders: 0,
        is_open: true,
      },
      { onConflict: "delivery_date,slot_type" }
    );

    if (!error) {
      await fetchSlots();
      showMessage("success", "Slot created.");
    } else {
      showMessage("error", error.message);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white transition-colors">
          ← Dashboard
        </Link>
        <h1 className="font-heading text-xl font-bold">Slot Management</h1>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { color: "bg-green-100 border-green-300", label: "Open" },
            { color: "bg-orange-100 border-orange-300", label: "Full" },
            { color: "bg-gray-100 border-gray-300", label: "Closed" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-sm text-text-muted">
              <div className={`w-4 h-4 rounded border ${l.color}`} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Toast */}
        {message && (
          <div
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium transition-all ${
              message.type === "success" ? "bg-success" : "bg-error"
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-text-muted text-sm font-medium w-24">
                    Slot
                  </th>
                  {dates.map((date) => {
                    const { weekday, date: dateLabel } = formatDateHeader(date);
                    const isToday = date === new Date().toISOString().split("T")[0];
                    return (
                      <th
                        key={date}
                        className={`px-2 py-2 text-center text-xs font-medium min-w-[90px] ${
                          isToday ? "text-primary" : "text-text-muted"
                        }`}
                      >
                        <div>{weekday}</div>
                        <div className={`font-bold ${isToday ? "text-primary" : "text-text-main"}`}>
                          {dateLabel}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(["morning", "evening"] as SlotType[]).map((slotType) => (
                  <tr key={slotType} className="border-t border-primary/10">
                    <td className="px-3 py-3 font-medium capitalize text-text-muted text-sm">
                      {slotType === "morning" ? "🌅 Morning" : "🌇 Evening"}
                    </td>
                    {dates.map((date) => {
                      const slot = getSlot(date, slotType);
                      const colorClass = getSlotColor(slot);

                      return (
                        <td key={date} className="px-2 py-3">
                          {slot ? (
                            <div
                              className={`rounded-lg border p-2 text-center text-xs ${colorClass}`}
                            >
                              <div className="font-semibold">
                                {slot.current_orders}/{slot.max_orders}
                              </div>
                              <div className="text-xs mt-0.5">
                                {slot.is_open ? "open" : "closed"}
                              </div>
                              <div className="flex gap-1 mt-2 justify-center">
                                <button
                                  onClick={() => toggleSlot(slot)}
                                  className="px-2 py-0.5 rounded bg-white/70 hover:bg-white text-xs font-medium border border-current/20 transition-colors"
                                >
                                  {slot.is_open ? "Close" : "Open"}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditModal({ slot });
                                    setEditMaxOrders(String(slot.max_orders));
                                  }}
                                  className="px-2 py-0.5 rounded bg-white/70 hover:bg-white text-xs font-medium border border-current/20 transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => ensureSlot(date, slotType)}
                              className="w-full rounded-lg border-2 border-dashed border-gray-300 p-2 text-center text-xs text-gray-400 hover:border-primary/40 hover:text-primary transition-colors"
                            >
                              + Create
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Edit modal */}
      {editModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setEditModal(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-card shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-heading text-lg font-semibold text-primary mb-1">
              Edit Slot
            </h3>
            <p className="text-text-muted text-sm mb-4">
              {editModal.slot.delivery_date} · {editModal.slot.slot_type}
            </p>

            <label className="label" htmlFor="maxOrders">Max Orders</label>
            <input
              id="maxOrders"
              type="number"
              min={1}
              value={editMaxOrders}
              onChange={(e) => setEditMaxOrders(e.target.value)}
              className="input mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveSlot}
                disabled={saving}
                className="flex-1 btn-primary"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
