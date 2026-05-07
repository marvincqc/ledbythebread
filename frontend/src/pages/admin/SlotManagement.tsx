import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { DeliverySlot, SlotType } from "../../types";

const DEFAULT_MAX = 10;

function getDateRange(weeksAhead: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < weeksAhead * 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
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
    full: d.toLocaleDateString("en-SG", { weekday: "long", month: "short", day: "numeric" }),
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
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeksAhead, setWeeksAhead] = useState(2);
  const [savingWeeks, setSavingWeeks] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingCapacity, setEditingCapacity] = useState<{ id: string; value: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const capacityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (editingCapacity) capacityInputRef.current?.focus();
  }, [editingCapacity]);

  async function init() {
    setLoading(true);
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
    const dates = getDateRange(weeks);

    // Fetch existing slots
    const { data } = await supabase
      .from("delivery_slots").select("*")
      .in("delivery_date", dates)
      .order("delivery_date").order("slot_type");
    const existing = (data ?? []) as DeliverySlot[];
    setSlots(existing);

    // Auto-generate missing slots silently
    const toInsert: { delivery_date: string; slot_type: SlotType; max_orders: number; is_open: boolean; current_orders: number }[] = [];
    for (const date of dates) {
      for (const slotType of ["morning", "evening"] as SlotType[]) {
        const exists = existing.some((s) => s.delivery_date === date && s.slot_type === slotType);
        if (!exists) {
          toInsert.push({
            delivery_date: date,
            slot_type: slotType,
            max_orders: DEFAULT_MAX,
            is_open: !isWeekend(date), // weekends closed by default
            current_orders: 0,
          });
        }
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase
        .from("delivery_slots").insert(toInsert).select();
      if (inserted) setSlots((prev) => [...prev, ...(inserted as DeliverySlot[])]);
    }
  }

  async function updateWeeksAhead(newWeeks: number) {
    if (newWeeks < 1 || newWeeks > 12) return;
    setWeeksAhead(newWeeks);
    setSavingWeeks(true);
    await supabase.from("admin_settings")
      .upsert({ key: "max_weeks_out", value: String(newWeeks) }, { onConflict: "key" });
    await loadAndGenerate(newWeeks);
    setSavingWeeks(false);
  }

  async function toggleSlot(slot: DeliverySlot) {
    setTogglingId(slot.id);
    const { error } = await supabase
      .from("delivery_slots").update({ is_open: !slot.is_open }).eq("id", slot.id);
    if (!error) {
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, is_open: !slot.is_open } : s));
    } else {
      showMessage("error", error.message);
    }
    setTogglingId(null);
  }

  async function saveCapacity(slot: DeliverySlot, value: string) {
    const max = parseInt(value);
    if (isNaN(max) || max < 1) { setEditingCapacity(null); return; }
    if (max === slot.max_orders) { setEditingCapacity(null); return; }
    const { error } = await supabase
      .from("delivery_slots").update({ max_orders: max }).eq("id", slot.id);
    if (!error) {
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, max_orders: max } : s));
      showMessage("success", "Capacity updated.");
    }
    setEditingCapacity(null);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  }

  function getSlot(date: string, type: SlotType) {
    return slots.find((s) => s.delivery_date === date && s.slot_type === type);
  }

  const today = new Date().toISOString().split("T")[0];
  const dates = getDateRange(weeksAhead);
  const weeks = groupByWeek(dates);

  // Summary stats
  const weekdaySlots = slots.filter((s) => !isWeekend(s.delivery_date));
  const openCount = weekdaySlots.filter((s) => s.is_open).length;
  const fullCount = weekdaySlots.filter((s) => s.is_open && s.current_orders >= s.max_orders).length;

  return (
    <div className="min-h-screen bg-background">
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

      {/* Config + stats bar */}
      <div className="border-b border-primary/10 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Weeks ahead control */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">Customers can pre-order up to</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateWeeksAhead(weeksAhead - 1)}
                disabled={weeksAhead <= 1 || savingWeeks}
                className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
              >−</button>
              <span className="w-8 text-center font-heading font-bold text-primary text-lg">{weeksAhead}</span>
              <button
                onClick={() => updateWeeksAhead(weeksAhead + 1)}
                disabled={weeksAhead >= 12 || savingWeeks}
                className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
              >+</button>
            </div>
            <span className="text-sm text-text-muted font-medium">weeks ahead</span>
            {savingWeeks && <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span><span className="font-semibold text-green-700">{openCount}</span> open</span>
            {fullCount > 0 && <span><span className="font-semibold text-orange-600">{fullCount}</span> full</span>}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} className="card overflow-hidden">
              {/* Week header */}
              <div className="bg-primary/5 px-4 py-2.5 border-b border-primary/10 flex items-center justify-between">
                <span className="font-semibold text-primary text-sm">{week.label}</span>
                <span className="text-xs text-text-muted">
                  {week.dates.filter((d) => !isWeekend(d)).reduce((n, d) => {
                    const m = getSlot(d, "morning"); const e = getSlot(d, "evening");
                    return n + (m?.is_open ? 1 : 0) + (e?.is_open ? 1 : 0);
                  }, 0)} open slots
                </span>
              </div>

              <div className="divide-y divide-primary/5">
                {/* Weekday rows */}
                {week.dates.filter((d) => !isWeekend(d)).map((date) => {
                  const isToday = date === today;
                  const { weekday, date: dateLabel } = formatDay(date);
                  return (
                    <div key={date} className={`flex items-center gap-3 px-4 py-3 ${isToday ? "bg-primary/5" : ""}`}>
                      {/* Date */}
                      <div className="w-24 flex-shrink-0">
                        <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-text-muted"}`}>{weekday}</span>
                        <p className={`text-sm font-semibold ${isToday ? "text-primary" : "text-text-main"}`}>{dateLabel}</p>
                        {isToday && <span className="text-xs text-primary font-medium">Today</span>}
                      </div>

                      {/* Slots */}
                      <div className="flex gap-3 flex-1">
                        {(["morning", "evening"] as SlotType[]).map((type) => {
                          const slot = getSlot(date, type);
                          if (!slot) return null;
                          const isFull = slot.current_orders >= slot.max_orders;
                          const isToggling = togglingId === slot.id;
                          return (
                            <div
                              key={type}
                              className={`flex-1 rounded-lg border transition-all ${
                                !slot.is_open
                                  ? "bg-gray-50 border-gray-200"
                                  : isFull
                                  ? "bg-orange-50 border-orange-200"
                                  : "bg-green-50 border-green-200"
                              }`}
                            >
                              <div className="px-3 py-2 flex items-center justify-between">
                                <div>
                                  <span className="text-xs text-text-muted block">{type === "morning" ? "🌅 Morning" : "🌇 Evening"}</span>
                                  {/* Inline capacity edit */}
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
                                      onClick={() => setEditingCapacity({ id: slot.id, value: String(slot.max_orders) })}
                                      title="Click to edit capacity"
                                      className={`text-sm font-bold hover:underline ${
                                        !slot.is_open ? "text-gray-500" : isFull ? "text-orange-700" : "text-green-700"
                                      }`}
                                    >
                                      {slot.current_orders}/{slot.max_orders}
                                    </button>
                                  )}
                                </div>
                                {/* Toggle */}
                                <button
                                  onClick={() => toggleSlot(slot)}
                                  disabled={isToggling}
                                  title={slot.is_open ? "Click to close" : "Click to open"}
                                  className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-60 ${
                                    slot.is_open ? "bg-green-500" : "bg-gray-300"
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

                {/* Weekend row — collapsed */}
                {week.dates.some(isWeekend) && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/80">
                    <div className="w-24 flex-shrink-0">
                      <span className="text-xs text-gray-400 font-medium">Sat – Sun</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs font-medium">Weekend · Closed</span>
                    </div>
                  </div>
                )}
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
    </div>
  );
}
