import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { pageCache } from "../../lib/pageCache";
import type { DeliveryZone } from "../../types";

function useSetting(initial = "") {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  return { value, setValue, saved, setSaved, saving, setSaving };
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{label}</p>;
}

interface OneMapResult { BLK_NO: string; ROAD_NAME: string; POSTAL: string; LATITUDE: string; LONGITUDE: string; }
interface ZoneForm { name: string; postal: string; lat: number | null; lng: number | null; address: string; radius: string; }
const defaultZoneForm: ZoneForm = { name: "", postal: "", lat: null, lng: null, address: "", radius: "10" };

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6; // 6am → 11pm
  const label = h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`;
  return { value: String(h), label };
});

export default function AdminSettings() {
  const minVal    = useSetting("0.00");
  const [minEnabled, setMinEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  const uen           = useSetting();
  const weeks         = useSetting("2");
  const morningCutoff = useSetting("17");
  const eveningCutoff = useSetting("11");
  const [savingCutoff, setSavingCutoff] = useState(false);

  const [loading, setLoading] = useState(!pageCache.get("admin-settings"));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delivery zones
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zoneModal, setZoneModal] = useState<{ open: boolean; editing: DeliveryZone | null }>({ open: false, editing: null });
  const [zoneForm, setZoneForm] = useState<ZoneForm>(defaultZoneForm);
  const [zoneLookup, setZoneLookup] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [zoneLookupError, setZoneLookupError] = useState("");
  const [zoneSaving, setZoneSaving] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);
  const [confirmDeleteZoneId, setConfirmDeleteZoneId] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchZones();
  }, []);

  async function fetchSettings() {
    if (!pageCache.get("admin-settings")) setLoading(true);
    try {
      const { data } = await supabase.from("admin_settings").select("key, value")
        .in("key", ["store_min_order_value", "store_min_order_value_enabled", "paynow_uen", "max_weeks_out", "morning_cutoff_hour", "evening_cutoff_hour"]);
      if (data) {
        const get = (k: string, fallback = "") => data.find((s) => s.key === k)?.value ?? fallback;
        minVal.setValue(get("store_min_order_value", "0.00"));
        minVal.setSaved(get("store_min_order_value", "0.00"));
        setMinEnabled(get("store_min_order_value_enabled") === "true");
        uen.setValue(get("paynow_uen"));
        uen.setSaved(get("paynow_uen"));
        weeks.setValue(get("max_weeks_out", "2"));
        weeks.setSaved(get("max_weeks_out", "2"));
        morningCutoff.setValue(get("morning_cutoff_hour", "17"));
        morningCutoff.setSaved(get("morning_cutoff_hour", "17"));
        eveningCutoff.setValue(get("evening_cutoff_hour", "11"));
        eveningCutoff.setSaved(get("evening_cutoff_hour", "11"));
        pageCache.set("admin-settings", data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function fetchZones() {
    setZonesLoading(true);
    try {
      const { data } = await supabase.from("delivery_zones").select("*").order("created_at");
      if (data) {
        setZones(data as DeliveryZone[]);
        pageCache.set("admin-zones", data);
      }
    } finally {
      setZonesLoading(false);
    }
  }

  async function lookupZonePostal(code: string) {
    setZoneLookup("loading");
    setZoneLookupError("");
    try {
      const res = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${code}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
      );
      const json = await res.json();
      if (!json.results?.length) {
        setZoneLookup("error");
        setZoneLookupError("Postal code not found.");
        return;
      }
      const match: OneMapResult = json.results.find((r: OneMapResult) => r.POSTAL === code) ?? json.results[0];
      setZoneForm((prev) => ({
        ...prev,
        lat: parseFloat(match.LATITUDE),
        lng: parseFloat(match.LONGITUDE),
        address: `${match.BLK_NO} ${match.ROAD_NAME} Singapore ${match.POSTAL}`,
      }));
      setZoneLookup("found");
    } catch {
      setZoneLookup("error");
      setZoneLookupError("Could not look up address.");
    }
  }

  function openZoneModal(zone: DeliveryZone | null) {
    setZoneModal({ open: true, editing: zone });
    setZoneLookup("idle");
    setZoneLookupError("");
    if (zone) {
      setZoneForm({ name: zone.name, postal: "", lat: zone.center_lat, lng: zone.center_lng, address: `${zone.center_lat.toFixed(4)}, ${zone.center_lng.toFixed(4)}`, radius: String(zone.radius_km) });
      setZoneLookup("found");
    } else {
      setZoneForm(defaultZoneForm);
    }
  }

  function closeZoneModal() {
    setZoneModal({ open: false, editing: null });
  }

  async function saveZone() {
    if (!zoneForm.name.trim()) { showMessage("error", "Zone name is required."); return; }
    if (zoneForm.lat === null || zoneForm.lng === null) { showMessage("error", "Look up a postal code to set the zone center."); return; }
    const radius = parseFloat(zoneForm.radius);
    if (isNaN(radius) || radius <= 0) { showMessage("error", "Enter a valid radius (km)."); return; }

    setZoneSaving(true);
    try {
      const payload = { name: zoneForm.name.trim(), center_lat: zoneForm.lat, center_lng: zoneForm.lng, radius_km: radius };
      if (zoneModal.editing) {
        const { error } = await supabase.from("delivery_zones").update(payload).eq("id", zoneModal.editing.id);
        if (error) { showMessage("error", error.message); return; }
        setZones((prev) => prev.map((z) => z.id === zoneModal.editing!.id ? { ...z, ...payload } : z));
        showMessage("success", "Zone updated.");
      } else {
        const { data, error } = await supabase.from("delivery_zones").insert(payload).select().single();
        if (error) { showMessage("error", error.message); return; }
        setZones((prev) => [...prev, data as DeliveryZone]);
        showMessage("success", "Zone created.");
      }
      pageCache.clear("admin-zones");
      closeZoneModal();
    } finally {
      setZoneSaving(false);
    }
  }

  async function deleteZone(id: string) {
    setDeletingZoneId(id);
    try {
      const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
      if (error) { showMessage("error", error.message); return; }
      setZones((prev) => prev.filter((z) => z.id !== id));
      pageCache.clear("admin-zones");
      showMessage("success", "Zone deleted.");
    } finally {
      setDeletingZoneId(null);
      setConfirmDeleteZoneId(null);
    }
  }

  async function save(
    key: string, value: string,
    setSaving: (v: boolean) => void, setSaved: (v: string) => void,
    successMsg: string, validate?: () => string | null
  ) {
    if (validate) { const err = validate(); if (err) { showMessage("error", err); return; } }
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_settings").upsert({ key, value }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setSaved(value); showMessage("success", successMsg); }
    } finally { setSaving(false); }
  }

  async function toggleMinOrderValue() {
    const next = !minEnabled;
    setSavingToggle(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "store_min_order_value_enabled", value: String(next) }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setMinEnabled(next); showMessage("success", next ? "Minimum order value activated." : "Minimum order value deactivated."); }
    } finally { setSavingToggle(false); }
  }

  async function saveCutoffTimes() {
    const m = parseInt(morningCutoff.value);
    const e = parseInt(eveningCutoff.value);
    if (isNaN(m) || m < 0 || m > 23) { showMessage("error", "Invalid morning cut-off hour."); return; }
    if (isNaN(e) || e < 0 || e > 23) { showMessage("error", "Invalid evening cut-off hour."); return; }
    setSavingCutoff(true);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from("admin_settings").upsert({ key: "morning_cutoff_hour", value: String(m) }, { onConflict: "key" }),
        supabase.from("admin_settings").upsert({ key: "evening_cutoff_hour", value: String(e) }, { onConflict: "key" }),
      ]);
      if (r1.error || r2.error) { showMessage("error", "Failed to save cut-off times."); }
      else {
        morningCutoff.setSaved(String(m));
        eveningCutoff.setSaved(String(e));
        showMessage("success", "Cut-off times saved.");
      }
    } finally { setSavingCutoff(false); }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Store Settings</h1>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${
          message.type === "success" ? "bg-success" : "bg-error"
        }`}>
          {message.text}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* Order Rules */}
            <div>
              <SectionLabel label="Order Rules" />
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-text-main">Minimum Order Value</h3>
                    <p className="text-text-muted text-xs mt-0.5">Cart total required to place an order.</p>
                  </div>
                  <button
                    onClick={toggleMinOrderValue}
                    disabled={savingToggle}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 ${
                      minEnabled ? "bg-green-500" : "bg-gray-300"
                    } disabled:opacity-60`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                      minEnabled ? "left-6" : "left-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">S$</span>
                    <input type="number" min="0" step="0.01" placeholder="0.00"
                      value={minVal.value} onChange={(e) => minVal.setValue(e.target.value)}
                      className="input pl-9" />
                  </div>
                  <button
                    onClick={() => save("store_min_order_value", parseFloat(minVal.value).toFixed(2),
                      minVal.setSaving, minVal.setSaved, "Minimum order value saved.",
                      () => (isNaN(parseFloat(minVal.value)) || parseFloat(minVal.value) < 0) ? "Enter a valid amount." : null)}
                    disabled={minVal.saving || minVal.value === minVal.saved}
                    className="btn-primary px-5 flex-shrink-0"
                  >
                    {minVal.saving ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className={`text-xs font-medium mt-3 ${minEnabled ? "text-green-600" : "text-text-muted"}`}>
                  {minEnabled
                    ? `Active — S$${parseFloat(minVal.saved).toFixed(2)} minimum enforced`
                    : "Inactive — no minimum order value"}
                </p>
              </div>
            </div>

            {/* Payments */}
            <div>
              <SectionLabel label="Payments" />
              <div className="card p-5">
                <h3 className="font-semibold text-text-main mb-0.5">PayNow UEN / Number</h3>
                <p className="text-text-muted text-xs mb-4">Shown to customers on the checkout payment screen.</p>
                <div className="flex gap-3">
                  <input type="text" placeholder="e.g. 202312345A or +65 9123 4567"
                    value={uen.value} onChange={(e) => uen.setValue(e.target.value)} className="input flex-1" />
                  <button onClick={() => save("paynow_uen", uen.value.trim(), uen.setSaving, uen.setSaved, "PayNow UEN saved.")}
                    disabled={uen.saving || uen.value === uen.saved} className="btn-primary px-5 flex-shrink-0">
                    {uen.saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div>
              <SectionLabel label="Delivery" />
              <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-text-main mb-0.5">Booking Window</h3>
                <p className="text-text-muted text-xs mb-4">How many weeks ahead customers can pre-order.</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input type="number" min="1" max="12" value={weeks.value}
                      onChange={(e) => weeks.setValue(e.target.value)} className="input w-24" />
                    <span className="text-sm text-text-muted">weeks</span>
                  </div>
                  <button
                    onClick={() => save("max_weeks_out",
                      String(Math.min(12, Math.max(1, parseInt(weeks.value) || 2))),
                      weeks.setSaving, weeks.setSaved, "Booking window saved.",
                      () => { const v = parseInt(weeks.value); return (isNaN(v) || v < 1 || v > 12) ? "Enter a number between 1 and 12." : null; })}
                    disabled={weeks.saving || weeks.value === weeks.saved}
                    className="btn-primary px-5 flex-shrink-0"
                  >
                    {weeks.saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {/* Cut-off times */}
              <div className="card p-5">
                <h3 className="font-semibold text-text-main mb-0.5">Order Cut-off Times</h3>
                <p className="text-text-muted text-xs mb-4">When orders stop being accepted for each slot (Singapore time).</p>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-muted w-28 flex-shrink-0">🌅 Morning</span>
                    <select value={morningCutoff.value} onChange={(e) => morningCutoff.setValue(e.target.value)} className="input flex-1">
                      {HOUR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <span className="text-xs text-text-muted flex-shrink-0 w-20">previous day</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-muted w-28 flex-shrink-0">🌇 Evening</span>
                    <select value={eveningCutoff.value} onChange={(e) => eveningCutoff.setValue(e.target.value)} className="input flex-1">
                      {HOUR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <span className="text-xs text-text-muted flex-shrink-0 w-20">same day</span>
                  </div>
                </div>
                <button
                  onClick={saveCutoffTimes}
                  disabled={savingCutoff || (morningCutoff.value === morningCutoff.saved && eveningCutoff.value === eveningCutoff.saved)}
                  className="btn-primary px-5"
                >
                  {savingCutoff ? "Saving…" : "Save"}
                </button>
              </div>
              </div>
            </div>

            {/* Delivery Zones */}
            <div>
              <SectionLabel label="Delivery Zones" />
              <div className="card p-5">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-semibold text-text-main">Zones</h3>
                    <p className="text-text-muted text-xs mt-0.5">
                      Assign a zone to a slot in Slot Management to restrict it to customers within that area.
                    </p>
                  </div>
                  <button onClick={() => openZoneModal(null)} className="btn-primary px-3 py-1.5 text-sm flex-shrink-0 ml-4">
                    + Add Zone
                  </button>
                </div>

                {zonesLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : zones.length === 0 ? (
                  <p className="text-text-muted text-sm text-center py-6">
                    No zones yet — all slots are available island-wide.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5">
                        <div>
                          <p className="font-medium text-sm text-text-main">{zone.name}</p>
                          <p className="text-xs text-text-muted">{zone.radius_km} km radius · {zone.center_lat.toFixed(4)}, {zone.center_lng.toFixed(4)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openZoneModal(zone)}
                            className="text-xs text-primary hover:text-primary-dark font-medium transition-colors">
                            Edit
                          </button>
                          {confirmDeleteZoneId === zone.id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-error">Sure?</span>
                              <button
                                onClick={() => deleteZone(zone.id)}
                                disabled={deletingZoneId === zone.id}
                                className="text-xs text-white bg-error hover:bg-error/80 px-2 py-0.5 rounded font-medium disabled:opacity-50"
                              >
                                {deletingZoneId === zone.id ? "…" : "Yes"}
                              </button>
                              <button onClick={() => setConfirmDeleteZoneId(null)}
                                className="text-xs text-text-muted hover:text-text-main">
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteZoneId(zone.id)}
                              className="text-xs text-error/60 hover:text-error font-medium transition-colors">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Zone modal */}
      {zoneModal.open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={closeZoneModal} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-card shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-heading text-lg font-semibold text-primary mb-5">
              {zoneModal.editing ? "Edit Zone" : "Add Delivery Zone"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Zone Name</label>
                <input type="text" value={zoneForm.name}
                  onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. East, North, Central"
                  className="input" />
              </div>
              <div>
                <label className="label">Center (Postal Code)</label>
                <div className="flex gap-2">
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={zoneForm.postal}
                    onChange={(e) => setZoneForm((p) => ({ ...p, postal: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    placeholder="e.g. 529560"
                    className={`input flex-1 font-mono tracking-widest ${
                      zoneLookup === "found" ? "border-success" : zoneLookup === "error" ? "border-error" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => zoneForm.postal.length === 6 && lookupZonePostal(zoneForm.postal)}
                    disabled={zoneForm.postal.length < 6 || zoneLookup === "loading"}
                    className="btn-primary px-3 text-sm flex-shrink-0 disabled:opacity-50"
                  >
                    {zoneLookup === "loading" ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                    ) : "Look up"}
                  </button>
                </div>
                {zoneLookup === "found" && zoneForm.address && (
                  <p className="text-xs text-success mt-1">{zoneForm.address}</p>
                )}
                {zoneLookupError && <p className="text-xs text-error mt-1">{zoneLookupError}</p>}
              </div>
              <div>
                <label className="label">Radius</label>
                <div className="flex items-center gap-3">
                  <input type="number" min="1" max="50" step="0.5"
                    value={zoneForm.radius}
                    onChange={(e) => setZoneForm((p) => ({ ...p, radius: e.target.value }))}
                    className="input w-24" />
                  <span className="text-sm text-text-muted">km from center</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeZoneModal} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={saveZone} disabled={zoneSaving} className="flex-1 btn-primary">
                {zoneSaving ? "Saving…" : zoneModal.editing ? "Update" : "Create Zone"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
