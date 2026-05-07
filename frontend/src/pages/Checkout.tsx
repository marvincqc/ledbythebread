import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { callEdgeFunction } from "../lib/supabase";
import type { DeliverySlot, SlotType } from "../types";

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
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    weekday: "short", month: "short", day: "numeric",
  });
}

interface OneMapResult {
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCartStore();
  const { user, profile } = useAuthStore();

  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<SlotType | "">("");
  const [slotsLoading, setSlotsLoading] = useState(true);

  // Address state
  const [postalCode, setPostalCode] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [addressLookup, setAddressLookup] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [addressResult, setAddressResult] = useState<OneMapResult | null>(null);
  const [addressError, setAddressError] = useState("");
  const postalDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contact state
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // PayNow proof
  const [payNowUen, setPayNowUen] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sub = subtotal();
  const dates = getNextDays(14);

  useEffect(() => {
    supabase.from("admin_settings").select("value").eq("key", "paynow_uen").single()
      .then(({ data }) => { if (data) setPayNowUen(data.value); });
  }, []);

  async function handleProofUpload(file: File) {
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setUploadingProof(true);
    setProofUrl(null);

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filename, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload payment proof: " + uploadError.message);
      setProofFile(null);
      setProofPreview(null);
    } else {
      const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(filename);
      setProofUrl(urlData.publicUrl);
    }
    setUploadingProof(false);
  }

  useEffect(() => {
    async function fetchSlots() {
      setSlotsLoading(true);
      const { data } = await supabase
        .from("delivery_slots").select("*").eq("is_open", true)
        .order("delivery_date", { ascending: true })
        .order("slot_type", { ascending: true });
      if (data) setSlots(data as DeliverySlot[]);
      setSlotsLoading(false);
    }
    fetchSlots();
  }, []);

  useEffect(() => {
    if (items.length === 0) navigate("/", { replace: true });
  }, [items, navigate]);

  // Auto-lookup when postal code reaches 6 digits
  useEffect(() => {
    if (postalDebounce.current) clearTimeout(postalDebounce.current);

    if (postalCode.length < 6) {
      setAddressLookup("idle");
      setAddressResult(null);
      setAddressError("");
      return;
    }

    if (postalCode.length === 6) {
      postalDebounce.current = setTimeout(() => lookupPostal(postalCode), 400);
    }

    return () => {
      if (postalDebounce.current) clearTimeout(postalDebounce.current);
    };
  }, [postalCode]);

  async function lookupPostal(code: string) {
    setAddressLookup("loading");
    setAddressResult(null);
    setAddressError("");

    try {
      const res = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${code}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
      );
      const json = await res.json();

      if (!json.results || json.results.length === 0) {
        setAddressLookup("error");
        setAddressError("Postal code not found. Please check and try again.");
        return;
      }

      // Pick the result that matches the postal code exactly
      const match: OneMapResult =
        json.results.find((r: OneMapResult) => r.POSTAL === code) ?? json.results[0];

      setAddressResult(match);
      setAddressLookup("found");
    } catch {
      setAddressLookup("error");
      setAddressError("Could not look up address. Please check your connection.");
    }
  }

  const getSlotsForDate = (date: string) => slots.filter((s) => s.delivery_date === date);

  const getSlotStatus = (slot: DeliverySlot) => {
    if (!slot.is_open) return "closed";
    if (slot.current_orders >= slot.max_orders) return "full";
    return "open";
  };

  // Compose final address string
  const buildAddress = () => {
    if (!addressResult) return "";
    const building = addressResult.BUILDING !== "NIL" ? ` ${addressResult.BUILDING}` : "";
    const unit = unitNo.trim() ? ` #${unitNo.trim().replace(/^#/, "")}` : "";
    return `${addressResult.BLK_NO} ${addressResult.ROAD_NAME}${building}${unit} Singapore ${addressResult.POSTAL}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDate || !selectedSlot) {
      setError("Please select a delivery date and slot.");
      return;
    }

    if (addressLookup !== "found" || !addressResult) {
      setError("Please enter a valid Singapore postal code.");
      return;
    }

    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("Please fill in all contact details.");
      return;
    }

    // Validate minimum sets per item
    const { data: minQtyRow } = await supabase
      .from("admin_settings").select("value").eq("key", "min_item_qty").single();
    const minQty = minQtyRow ? parseInt(minQtyRow.value) : 6;
    const belowMin = items.find((i) => i.quantity < minQty);
    if (belowMin) {
      setError(`Minimum is ${minQty} sets per item. "${belowMin.sku.name}" has ${belowMin.quantity}.`);
      return;
    }

    if (!proofUrl) {
      setError("Please upload your PayNow payment screenshot before placing your order.");
      return;
    }

    setLoading(true);

    const { data, error: fnError } = await callEdgeFunction<{ order_id: string }>("place-order", {
      customer_id: user?.id ?? undefined,
      guest_info: { name: name.trim(), phone: phone.trim(), email: email.trim() },
      delivery_address: buildAddress(),
      lat: parseFloat(addressResult.LATITUDE),
      lng: parseFloat(addressResult.LONGITUDE),
      delivery_date: selectedDate,
      slot_type: selectedSlot,
      items: items.map((i) => ({ sku_id: i.sku.id, quantity: i.quantity, unit_price: i.sku.price })),
      metadata: { payment_proof_url: proofUrl },
    });

    setLoading(false);

    if (fnError || !data?.order_id) {
      setError(fnError ?? "Failed to place order. Please try again.");
      return;
    }
    clearCart();
    navigate(`/order/${data.order_id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Delivery Slot */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">Select Delivery Slot</h2>
          {slotsLoading ? (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading available slots...
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {dates.map((date) => {
                  const dateSlots = getSlotsForDate(date);
                  const hasOpen = dateSlots.some((s) => s.is_open && s.current_orders < s.max_orders);
                  const isSelected = selectedDate === date;
                  return (
                    <button key={date} type="button"
                      onClick={() => { setSelectedDate(date); setSelectedSlot(""); }}
                      disabled={!hasOpen}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-center transition-all ${
                        isSelected ? "bg-primary text-white font-semibold shadow"
                        : hasOpen ? "bg-white border border-primary/30 hover:border-primary text-text-muted hover:text-primary"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                      }`}
                    >
                      <span className="block text-xs font-medium">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short" })}
                      </span>
                      <span className="block text-sm font-bold mt-0.5">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="grid grid-cols-2 gap-3">
                  {(["morning", "evening"] as SlotType[]).map((slotType) => {
                    const slot = getSlotsForDate(selectedDate).find((s) => s.slot_type === slotType);
                    const status = slot ? getSlotStatus(slot) : "closed";
                    const isSelected = selectedSlot === slotType;
                    const available = status === "open";
                    return (
                      <button key={slotType} type="button"
                        onClick={() => available && setSelectedSlot(slotType)}
                        disabled={!available}
                        className={`relative p-4 rounded-card border-2 text-left transition-all ${
                          isSelected ? "border-primary bg-primary/5"
                          : available ? "border-primary/20 hover:border-primary/50 bg-white"
                          : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{slotType === "morning" ? "🌅" : "🌇"}</span>
                          <span className="font-semibold capitalize text-text-main">{slotType}</span>
                          {isSelected && (
                            <span className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">
                          {slotType === "morning" ? "7:00 AM – 10:00 AM" : "5:00 PM – 8:00 PM"}
                        </p>
                        <p className="text-xs mt-1">
                          {status === "open" && slot && <span className="text-success font-medium">{slot.max_orders - slot.current_orders} slots left</span>}
                          {status === "full" && <span className="text-error font-medium">Fully booked</span>}
                          {status === "closed" && <span className="text-text-muted">Closed</span>}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              {!selectedDate && <p className="text-text-muted text-sm mt-2">Select a date above to see available slots.</p>}
            </>
          )}
        </div>

        {/* Delivery Address */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">Delivery Address</h2>

          {/* Step 1: Postal code */}
          <div className="mb-4">
            <label className="label" htmlFor="postal">
              Singapore Postal Code
            </label>
            <div className="relative">
              <input
                id="postal"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="e.g. 560123"
                className={`input pr-10 font-mono tracking-widest ${
                  addressLookup === "found" ? "border-success focus:border-success" :
                  addressLookup === "error" ? "border-error focus:border-error" : ""
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {addressLookup === "loading" && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                {addressLookup === "found" && (
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {addressLookup === "error" && (
                  <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {addressError && <p className="text-error text-xs mt-1">{addressError}</p>}
          </div>

          {/* Step 2: Auto-filled address */}
          {addressLookup === "found" && addressResult && (
            <div className="mb-4 bg-primary/5 rounded-lg px-4 py-3 border border-primary/20">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-1">Address found</p>
              <p className="text-text-main font-medium">
                {addressResult.BLK_NO} {addressResult.ROAD_NAME}
                {addressResult.BUILDING !== "NIL" && (
                  <span className="text-text-muted"> · {addressResult.BUILDING}</span>
                )}
              </p>
              <p className="text-text-muted text-sm">Singapore {addressResult.POSTAL}</p>
            </div>
          )}

          {/* Step 3: Unit number */}
          {addressLookup === "found" && (
            <div>
              <label className="label" htmlFor="unit">
                Unit Number <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="unit"
                type="text"
                value={unitNo}
                onChange={(e) => setUnitNo(e.target.value)}
                placeholder="#05-10"
                className="input"
              />
              {/* Preview */}
              {buildAddress() && (
                <p className="text-text-muted text-xs mt-2">
                  <span className="font-medium text-text-main">Full address: </span>
                  {buildAddress()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contact Details */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">Contact Details</h2>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your full name" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone number</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+65 9XXX XXXX" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" className="input" required />
            </div>
          </div>
        </div>

        {/* PayNow Payment */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-1">Payment</h2>
          <p className="text-text-muted text-sm mb-4">Scan the QR code with your banking app, then upload your screenshot below.</p>

          <div className="flex flex-col items-center mb-4">
            <img
              src="/paynow-qr.png"
              alt="PayNow QR Code"
              className="w-48 h-48 object-contain rounded-lg border border-primary/10"
            />
            <div className="mt-3 text-center">
              <p className="text-sm text-text-muted">Amount to pay</p>
              <p className="font-heading text-2xl font-bold text-primary">S${sub.toFixed(2)}</p>
              {payNowUen && (
                <p className="text-xs text-text-muted mt-1">UEN: <span className="font-medium text-text-main">{payNowUen}</span></p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Payment Screenshot <span className="text-error">*</span></label>
            <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-card p-6 cursor-pointer transition-all ${
              proofUrl ? "border-success bg-success/5" : "border-primary/30 hover:border-primary/60 hover:bg-primary/5"
            }`}>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProofUpload(f); }}
                disabled={uploadingProof}
              />
              {uploadingProof ? (
                <>
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-text-muted">Uploading…</span>
                </>
              ) : proofPreview ? (
                <>
                  <img src={proofPreview} alt="Payment proof" className="max-h-40 rounded-lg object-contain" />
                  <span className="text-xs text-success font-medium">
                    {proofUrl ? "✓ Uploaded — tap to replace" : "Uploading…"}
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 text-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-primary">Tap to upload screenshot</span>
                  <span className="text-xs text-text-muted">JPG, PNG accepted</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Order Summary */}
        <div className="card p-5">
          <h2 className="font-heading text-xl font-semibold text-primary mb-4">Order Summary</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.sku.id} className="flex justify-between text-sm">
                <span className="text-text-muted">
                  {item.sku.name} <span className="font-medium text-text-main">×{item.quantity}</span>
                </span>
                <span className="font-medium">S${(item.sku.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-primary/10 pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Subtotal</span>
              <span className="font-bold text-xl text-primary">S${sub.toFixed(2)}</span>
            </div>
          </div>
          {selectedDate && selectedSlot && (
            <div className="mt-3 pt-3 border-t border-primary/10 text-sm text-text-muted">
              <span className="font-medium text-text-main">Delivery: </span>
              {formatDate(selectedDate)} · {selectedSlot.charAt(0).toUpperCase() + selectedSlot.slice(1)} slot
            </div>
          )}
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 text-error rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploadingProof || !proofUrl}
          className="w-full btn-primary py-4 text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Placing Order…
            </span>
          ) : !proofUrl ? "Upload payment screenshot to continue" : "Place Order"}
        </button>

        <p className="text-center text-xs text-text-muted">
          Payment is verified via PayNow screenshot. Your order will be confirmed once payment is checked.
        </p>
      </form>
    </div>
  );
}
