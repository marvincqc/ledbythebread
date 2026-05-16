import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { DeliverySlot, DeliveryZone, SlotType } from "../../types";
import { pageCache } from "../../lib/pageCache";
import { getNextDays, isoDateSGT } from "../../lib/utils";

const DEFAULT_MAX = 10;

function getSlotCutoffDate(deliveryDate: string, slotType: SlotType, cutoffOverride: string | null): Date {
  if (cutoffOverride) return new Date(cutoffOverride);
  const [y, m, d] = deliveryDate.split("-").map(Number);
  if (slotType === "morning") {
    return new Date(Date.UTC(y, m - 1, d - 1, 9, 0));
  }
  return new Date(Date.UTC(y, m - 1, d, 3, 0));
}

function isSlotExpired(deliveryDate: string, slotType: SlotType, cutoffOverride: string | null): boolean {
  return new Date() >= getSlotCutoffDate(deliveryDate, slotType, cutoffOverride);
}

function slotCutoffLabel(deliveryDate: string, slotType: SlotType, cutoffOverride: string | null): string {
  if (isSlotExpired(deliveryDate, slotType, cutoffOverride)) return "expired";
  if (cutoffOverride) {
    return `cut-off ${new Date(cutoffOverride).toLocaleTimeString("en-SG", {
      hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore", hour12: true,
    })}`;
  }
  if (slotType === "evening") return "cut-off 11am";
  const [y, m, d] = deliveryDate.split("-").map(Number);
  const cutoffDate = new Date(y, m - 1, d - 1);
  return `cut-off 5pm ${cutoffDate.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`;
}

function getDOW(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getDay(); // 0=Sun, 6=Sat
}

function isWeekend(dateStr: string) {
  const dow = getDOW(dateStr);
  return dow === 0 || dow === 6;
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-SG", { weekday: "short" }),
    date: d.toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
  };
}

function groupByWeek(dates: string[]): { label: string; dates: string[] }[] {
  const weeks: { label: string; dates: string[] }[] = [];
  let current: string[] = [];
  dates.forEach((d) => {
    const dow = getDOW(d);
    if (dow === 1 && current.length > 0) { // Monday starts new week
      const start = formatDay(current[0]);
      const end = formatDay(current[current.length - 1]);
      weeks.push({ label: `${start.date} – ${end.date}`, dates: current });
      current = [];
    }
    current.push(d);
  });
  if (current.length > 0) {
    const start = formatDay(current[0]);
    const end = formatDay(current[current.length - 1]);
    weeks.push({ label: `${start.date} – ${end.date}`, dates: current });
  }
  return weeks;
}

export default function SlotManagement() {
  const [slots, setSlots] = useState<DeliverySlot[]>(() => pageCache.get<DeliverySlot[]>('admin-slots') ?? []);
  const [savedSlots, setSavedSlots] = useState<DeliverySlot[]>(() => pageCache.get<DeliverySlot[]>('admin-slots') ?? []);
  const [loading, setLoading] = useState(!pageCache.get('admin-slots'));
  const [zones, setZones] = useState<DeliveryZone[]>(() => pageCache.get<DeliveryZone[]>('admin-zones') ?? []);
  const [weeksAhead, setWeeksAhead] = useState(2);
  const [editingCapacity, setEditingCapacity] = useState<{ id: string; value: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const capacityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    init();
    supabase.from("delivery_zones").select("*").order("created_at")
      .then(({ data }) => { if (data) { setZones(data as DeliveryZone[]); pageCache.set('admin-zones', data); } });
  }, []);

  useEffect(() => {
    if (editingCapacity) capacityInputRef.current?.focus();
  }, [editingCapacity]);

  async function init() {
    if (!pageCache.get('admin-slots')) setLoading(true);
    try {
      // Fetch weeks setting
      const { data: setting } = await supabase
        .from("admin_settings").select("value").eq("key", "max_weeks_out").single();
      const weeks = setting ? parseInt(setting.value) : 2;
      setWeeksAhead(weeks);

      // Fetch + auto-generate slots
      await loadAndGenerate(weeks);
    } finally {
      setLoading(false);
    }
  }

  async function loadAndGenerate(weeks: number) {
    const dates = getNextDays(weeks * 7);

    // Fetch existing slots + real order counts in parallel
    const [slotsRes, ordersRes] = await Promise.all([
      supabase.from("delivery_slots").select("*")
        .in("delivery_date", dates)
        .order("delivery_date").order("slot_type"),
      supabase.from("orders").select("delivery_date, slot_type")
        .in("delivery_date", dates)
        .not("status", "in", "(cancelled,delivered)"),
    ]);

    const existing = (slotsRes.data ?? []) as DeliverySlot[];

    // Calculate real current_orders from actual active orders
    const orderCounts: Record<string, number> = {};
    for (const o of ordersRes.data ?? []) {
      const key = `${o.delivery_date}|${o.slot_type}`;
      orderCounts[key] = (orderCounts[key] ?? 0) + 1;
    }

    // Sync current_orders in DB if stale, update local state with real counts
    const syncUpdates: PromiseLike<unknown>[] = [];
    const synced = existing.map((slot) => {
      const key = `${slot.delivery_date}|${slot.slot_type}`;
      const realCount = orderCounts[key] ?? 0;
      if (realCount !== slot.current_orders) {
        syncUpdates.push(
          supabase.from("delivery_slots")
            .update({ current_orders: realCount })
            .eq("id", slot.id)
        );
        return { ...slot, current_orders: realCount };
      }
      return slot;
    });
    if (syncUpdates.length > 0) await Promise.all(syncUpdates);
    setSlots(synced);
    setSavedSlots(synced);

    // Auto-generate missing slots silently (weekdays open, weekends closed, default 10)
    const toInsert: { delivery_date: string; slot_type: SlotType; max_orders: number; is_open: boolean; current_orders: number }[] = [];
    for (const date of dates) {
      for (const slotType of ["morning", "evening"] as SlotType[]) {
        const exists = synced.some((s) => s.delivery_date === date && s.slot_type === slotType);
        if (!exists) {
          toInsert.push({
            delivery_date: date,
            slot_type: slotType,
            max_orders: DEFAULT_MAX,
            is_open: !isWeekend(date),
            current_orders: orderCounts[`${date}|${slotType}`] ?? 0,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from("delivery_slots").insert(toInsert).select();
      if (inserted) {
        setSlots((prev) => {
          const next = [...prev, ...(inserted as DeliverySlot[])];
          setSavedSlots(next);
          pageCache.set('admin-slots', next);
          return next;
        });
        return;
      }
    }
    pageCache.set('admin-slots', synced);
  }

  function toggleSlot(slot: DeliverySlot) {
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, is_open: !slot.is_open } : s));
  }

  function changeZone(slot: DeliverySlot, zoneId: string | null) {
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, zone_id: zoneId } : s));
  }

  function saveCapacity(slot: DeliverySlot, value: string) {
    const max = parseInt(value);
    if (isNaN(max) || max < 1) { setEditingCapacity(null); return; }
    if (max === slot.max_orders) { setEditingCapacity(null); return; }
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, max_orders: max } : s));
    setEditingCapacity(null);
  }

  async function saveAllSlots() {
    const changed = slots.filter((s) => {
      const saved = savedSlots.find((ss) => ss.id === s.id);
      return saved && (s.is_open !== saved.is_open || s.max_orders !== saved.max_orders || s.zone_id !== saved.zone_id);
    });
    if (changed.length === 0) return;
    const updates = changed.map((s) =>
      supabase.from("delivery_slots").update({ is_open: s.is_open, max_orders: s.max_orders, zone_id: s.zone_id ?? null }).eq("id", s.id)
    );
    const results = await Promise.all(updates);
    const failed = results.filter((r) => r.error);
    if (failed.length) {
      showMessage("error", "Some changes failed to save. Please try again.");
    } else {
      setSavedSlots([...slots]);
      pageCache.set('admin-slots', [...slots]);
      showMessage("success", "All changes saved.");
    }
  }

  function discardSlots() {
    setSlots([...savedSlots]);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  }

  function getSlot(date: string, type: SlotType) {
    return slots.find((s) => s.delivery_date === date && s.slot_type === type);
  }

  const today = isoDateSGT();
  const dates = getNextDays(weeksAhead * 7);
  const weeks = groupByWeek(dates);

  // Summary stats
  const weekdaySlots = slots.filter((s) => !isWeekend(s.delivery_date));
  const fullCount = weekdaySlots.filter((s) => s.is_open && s.current_orders >= s.max_orders).length;

  // Dirty tracking
  const changedSlots = slots.filter((s) => {
    const saved = savedSlots.find((ss) => ss.id === s.id);
    return saved && (s.is_open !== saved.is_open || s.max_orders !== saved.max_orders || s.zone_id !== saved.zone_id);
  });
  const isDirty = changedSlots.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
          <h1 className="font-heading text-xl font-bold">Slot Management</h1>
        </div>
        <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">Auto-fills on load</span>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-card shadow-lg text-white text-sm font-medium ${message.type === "success" ? "bg-success" : "bg-error"}`}>
          {message.text}
        </div>
      )}

      {fullCount > 0 && (
        <div className="border-b border-primary/10 bg-white px-4 py-2.5">
          <div className="max-w-2xl mx-auto text-xs text-text-muted">
            <span className="font-semibold text-orange-600">{fullCount}</span> slot{fullCount !== 1 ? "s" : ""} fully booked
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="card overflow-hidden">
              {/* Week header */}
              <div className="bg-primary/5 px-4 py-2.5 border-b border-primary/10">
                <span className="font-semibold text-primary text-sm">{week.label}</span>
              </div>

              <div className="divide-y divide-primary/5">
                {week.dates.map((date) => {
                  const isToday = date === today;
                  const weekend = isWeekend(date);
                  const { weekday, date: dateLabel } = formatDay(date);
                  const hasDateChange = (["morning", "evening"] as SlotType[]).some((type) => {
                    const slot = getSlot(date, type);
                    if (!slot) return false;
                    const saved = savedSlots.find((ss) => ss.id === slot.id);
                    return saved && (slot.is_open !== saved.is_open || slot.max_orders !== saved.max_orders);
                  });
                  return (
                    <div key={date} className={`flex items-center gap-3 px-4 py-3 ${hasDateChange ? "bg-yellow-50/60" : isToday ? "bg-primary/5" : weekend ? "bg-gray-50/60" : ""}`}>
                      {/* Date */}
                      <div className="w-24 flex-shrink-0">
                        <span className={`text-xs font-medium ${isToday ? "text-primary" : weekend ? "text-gray-400" : "text-text-muted"}`}>{weekday}</span>
                        <p className={`text-sm font-semibold ${isToday ? "text-primary" : weekend ? "text-gray-400" : "text-text-main"}`}>{dateLabel}</p>
                        {isToday && <span className="text-xs text-primary font-medium">Today</span>}
                      </div>

                      {/* Slots */}
                      <div className="flex gap-3 flex-1">
                        {(["morning", "evening"] as SlotType[]).map((type) => {
                          const slot = getSlot(date, type);
                          if (!slot) return null;
                          const isFull = slot.current_orders >= slot.max_orders;
                          const expired = isSlotExpired(date, type, slot.cut_off_override ?? null);
                          return (
                            <div
                              key={type}
                              className={`flex-1 rounded-lg border transition-all ${
                                expired
                                  ? "bg-gray-50 border-gray-300 opacity-60"
                                  : !slot.is_open
                                  ? "bg-gray-50 border-gray-200"
                                  : isFull
                                  ? "bg-orange-50 border-orange-200"
                                  : "bg-green-50 border-green-200"
                              }`}
                            >
                              <div className="px-3 py-2 flex items-center justify-between">
                                <div>
                                  <span className="text-xs text-text-muted block">{type === "morning" ? "🌅 Morning" : "🌇 Evening"}</span>
                                  <span className={`text-xs block ${expired ? "text-error/60 italic" : "text-text-muted/60"}`}>
                                    {slotCutoffLabel(date, type, slot.cut_off_override ?? null)}
                                  </span>
                                  {editingCapacity?.id === slot.id ? (
                                    <input
                                      ref={capacityInputRef}
                                      type="number"
                                      min={1}
                                      value={editingCapacity.value}
                                      onChange={(e) => setEditingCapacity({ id: slot.id, value: e.target.value })}
                                      onBlur={() => saveCapacity(slot, editingCapacity.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveCapacity(slot, editingCapacity.value);
                                        if (e.key === "Escape") setEditingCapacity(null);
                                      }}
                                      className="w-16 text-sm font-bold border border-primary rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => !expired && setEditingCapacity({ id: slot.id, value: String(slot.max_orders) })}
                                      title={expired ? undefined : "Click to edit capacity"}
                                      className={`text-sm font-bold ${expired ? "text-gray-400 cursor-default" : `hover:underline ${!slot.is_open ? "text-gray-500" : isFull ? "text-orange-700" : "text-green-700"}`}`}
                                    >
                                      {slot.current_orders}/{slot.max_orders}
                                    </button>
                                  )}
                                  {zones.length > 0 && (
                                    <select
                                      value={slot.zone_id ?? ""}
                                      onChange={(e) => changeZone(slot, e.target.value || null)}
                                      className="mt-1 text-xs border border-primary/20 rounded px-1 py-0.5 bg-white text-text-muted focus:outline-none focus:border-primary max-w-[100px]"
                                      title="Delivery zone"
                                    >
                                      <option value="">All areas</option>
                                      {zones.map((z) => (
                                        <option key={z.id} value={z.id}>{z.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                <button
                                  onClick={() => toggleSlot(slot)}
                                  title={expired ? "Cut-off passed — customers cannot order this slot" : slot.is_open ? "Click to close" : "Click to open"}
                                  className={`relative w-10 h-5 rounded-full transition-colors ${
                                    expired ? "bg-gray-300 cursor-not-allowed" : slot.is_open ? "bg-green-500" : "bg-gray-300"
                                  }`}
                                >
                                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                    slot.is_open ? "left-5" : "left-0.5"
                                  }`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Legend */}
      <div className="max-w-2xl mx-auto px-4 pb-8 flex gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Open</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />Full</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />Closed</span>
        <span className="ml-auto">Click capacity number to edit · Toggle switch to open/close</span>
      </div>

      {/* ── Sticky Save Bar ─────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-primary/20 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-warning inline-block" />
              <span className="text-text-muted">
                <span className="font-semibold text-text-main">{changedSlots.length} slot{changedSlots.length !== 1 ? "s" : ""}</span> with unsaved changes
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={discardSlots}
                className="text-sm text-text-muted hover:text-error font-medium transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveAllSlots}
                className="btn-primary px-6 py-2 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
