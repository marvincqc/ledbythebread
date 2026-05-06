import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { callEdgeFunction } from "../lib/supabase";
import type { DeliverySlot, SlotType } from "../types";

// Generate dates for the next 14 days
function getNextDays(count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCartStore();
  const { user, profile } = useAuthStore();

  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<SlotType | "">("");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);

  const sub = subtotal();
  const dates = getNextDays(14);

  // Fetch open slots
  useEffect(() => {
    async function fetchSlots() {
      setSlotsLoading(true);
      const { data } = await supabase
        .from("delivery_slots")
        .select("*")
        .eq("is_open", true)
        .order("delivery_date", { ascending: true })
        .order("slot_type", { ascending: true });

      if (data) setSlots(data as DeliverySlot[]);
      setSlotsLoading(false);
    }
    fetchSlots();
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) navigate("/", { replace: true });
  }, [items, navigate]);

  const getSlotsForDate = (date: string) =>
    slots.filter((s) => s.delivery_date === date);

  const getSlotStatus = (slot: DeliverySlot) => {
    if (!slot.is_open) return "closed";
    if (slot.current_orders >= slot.max_orders) return "full";
    return "open";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDate || !selectedSlot) {
      setError("Please select a delivery date and slot.");
      return;
    }

    if (!address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }

    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("Please fill in all contact details.");
      return;
    }

    setLoading(true);

    const payload = {
      customer_id: user?.id ?? undefined,
      guest_info: {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      },
      delivery_address: address.trim(),
      delivery_date: selectedDate,
      slot_type: selectedSlot,
      items: items.map((i) => ({
        sku_id: i.sku.id,
        quantity: i.quantity,
        unit_price: i.sku.price,
      })),
    };

    const { data, error: fnError } = await callEdgeFunction<{ order_id: string }>(
      "place-order",
      payload
    );

    setLoading(false);

    if (fnError) {
      setError(fnError);
      return;
    }

    clearCart();
    navigate(`/order/${data!.order_id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Delivery Slot Selection */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">
            Select Delivery Slot
          </h2>

          {slotsLoading ? (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading available slots...
            </div>
          ) : (
            <>
              {/* Date picker */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {dates.map((date) => {
                  const dateSlots = getSlotsForDate(date);
                  const hasOpen = dateSlots.some(
                    (s) => s.is_open && s.current_orders < s.max_orders
                  );
                  const isSelected = selectedDate === date;

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot("");
                      }}
                      disabled={!hasOpen}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-center transition-all ${
                        isSelected
                          ? "bg-primary text-white font-semibold shadow"
                          : hasOpen
                          ? "bg-white border border-primary/30 hover:border-primary text-text-muted hover:text-primary"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                      }`}
                    >
                      <span className="block text-xs font-medium">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short" })}
                      </span>
                      <span className="block text-sm font-bold mt-0.5">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Slot selector */}
              {selectedDate && (
                <div className="grid grid-cols-2 gap-3">
                  {(["morning", "evening"] as SlotType[]).map((slotType) => {
                    const slot = getSlotsForDate(selectedDate).find(
                      (s) => s.slot_type === slotType
                    );
                    const status = slot ? getSlotStatus(slot) : "closed";
                    const isSelected = selectedSlot === slotType;
                    const available = status === "open";

                    return (
                      <button
                        key={slotType}
                        type="button"
                        onClick={() => available && setSelectedSlot(slotType)}
                        disabled={!available}
                        className={`relative p-4 rounded-card border-2 text-left transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : available
                            ? "border-primary/20 hover:border-primary/50 bg-white"
                            : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">
                            {slotType === "morning" ? "🌅" : "🌇"}
                          </span>
                          <span className="font-semibold capitalize text-text-main">
                            {slotType}
                          </span>
                          {isSelected && (
                            <span className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {slotType === "morning" ? "5:00 AM – 9:00 AM" : "4:00 PM – 8:00 PM"}
                        </p>
                        <p className="text-xs mt-1">
                          {status === "open" && slot && (
                            <span className="text-success font-medium">
                              {slot.max_orders - slot.current_orders} slots left
                            </span>
                          )}
                          {status === "full" && (
                            <span className="text-error font-medium">Fully booked</span>
                          )}
                          {status === "closed" && (
                            <span className="text-text-muted">Closed</span>
                          )}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {!selectedDate && (
                <p className="text-text-muted text-sm mt-2">
                  Select a date above to see available delivery slots.
                </p>
              )}
            </>
          )}
        </div>

        {/* Delivery Address */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">
            Delivery Address
          </h2>
          <label className="label" htmlFor="address">
            Full delivery address
          </label>
          <textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House/Unit no., Street, Barangay, City, Province"
            rows={3}
            className="input resize-none"
            required
          />
        </div>

        {/* Contact Details */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">
            Contact Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan dela Cruz"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XX XXX XXXX"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@example.com"
                className="input"
                required
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">
            Order Summary
          </h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.sku.id} className="flex justify-between text-sm">
                <span className="text-text-muted">
                  {item.sku.name}{" "}
                  <span className="font-medium text-text-main">×{item.quantity}</span>
                </span>
                <span className="font-medium">
                  ₱{(item.sku.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-primary/10 pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Subtotal</span>
              <span className="font-bold text-xl text-primary">₱{sub.toFixed(2)}</span>
            </div>
          </div>

          {selectedDate && selectedSlot && (
            <div className="mt-3 pt-3 border-t border-primary/10 text-sm text-text-muted">
              <span className="font-medium text-text-main">Delivery: </span>
              {formatDate(selectedDate)} · {selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1)} slot
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-error/10 border border-error/30 text-error rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-4 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Placing Order...
            </span>
          ) : (
            "Place Order (Cash on Delivery)"
          )}
        </button>

        <p className="text-center text-xs text-text-muted">
          By placing this order, you agree to pay upon delivery (COD). No payment is charged now.
        </p>
      </form>
    </div>
  );
}
