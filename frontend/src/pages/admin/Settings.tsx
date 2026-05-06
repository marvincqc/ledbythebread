import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { AdminSetting } from "../../types";

interface SettingMeta {
  label: string;
  description: string;
  type: "number" | "text" | "boolean";
  placeholder?: string;
  min?: number;
  max?: number;
  default?: string;
  unit?: string;
}

// All known settings — both core and optional custom ones
const KNOWN_SETTINGS: Record<string, SettingMeta> = {
  // Core (always present)
  min_order_amount: {
    label: "Minimum Order Amount",
    description: "The minimum subtotal (S$) required to place an order.",
    type: "number",
    min: 0,
    unit: "S$",
    default: "15",
    placeholder: "15",
  },
  max_weeks_out: {
    label: "Maximum Weeks Out",
    description: "How many weeks ahead customers can pre-order.",
    type: "number",
    min: 1,
    max: 8,
    unit: "weeks",
    default: "2",
    placeholder: "2",
  },
  // Optional custom settings
  delivery_fee: {
    label: "Delivery Fee",
    description: "Flat delivery fee charged per order (S$). Set to 0 for free delivery.",
    type: "number",
    min: 0,
    unit: "S$",
    default: "3",
    placeholder: "3",
  },
  free_delivery_threshold: {
    label: "Free Delivery Above",
    description: "Orders above this amount (S$) get free delivery.",
    type: "number",
    min: 0,
    unit: "S$",
    default: "50",
    placeholder: "50",
  },
  max_orders_per_slot: {
    label: "Default Max Orders per Slot",
    description: "Default capacity for newly created delivery slots.",
    type: "number",
    min: 1,
    unit: "orders",
    default: "30",
    placeholder: "30",
  },
  announcement: {
    label: "Store Announcement",
    description: "Banner message shown to all customers on the storefront.",
    type: "text",
    default: "",
    placeholder: "e.g. We are closed on 25 Dec. Happy holidays!",
  },
  store_whatsapp: {
    label: "WhatsApp Number",
    description: "WhatsApp contact number shown to customers (with country code).",
    type: "text",
    default: "+65 9XXX XXXX",
    placeholder: "+65 91234567",
  },
  store_instagram: {
    label: "Instagram Handle",
    description: "Instagram username shown in the footer (without @).",
    type: "text",
    default: "",
    placeholder: "ledbythebread.sg",
  },
  paynow_uen: {
    label: "PayNow UEN",
    description: "PayNow UEN or mobile number for payment instructions at checkout.",
    type: "text",
    default: "",
    placeholder: "e.g. 202312345A or +65 91234567",
  },
  holiday_message: {
    label: "Holiday Closure Message",
    description: "Shown when the store is temporarily closed. Leave blank to hide.",
    type: "text",
    default: "",
    placeholder: "We are on a short break. Back on 2 Jan!",
  },
  operating_areas: {
    label: "Operating Areas",
    description: "Comma-separated list of delivery zones (shown on checkout page).",
    type: "text",
    default: "",
    placeholder: "Ang Mo Kio, Bishan, Toa Payoh, Serangoon",
  },
};

const CORE_KEYS = new Set(["min_order_amount", "max_weeks_out"]);

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedKey, setSelectedKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  // When selected key changes, pre-fill the default value
  useEffect(() => {
    if (selectedKey && KNOWN_SETTINGS[selectedKey]) {
      setNewValue(KNOWN_SETTINGS[selectedKey].default ?? "");
    } else {
      setNewValue("");
    }
  }, [selectedKey]);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_settings")
      .select("*")
      .order("key", { ascending: true });
    if (data) {
      setSettings(data as AdminSetting[]);
      const vals: Record<string, string> = {};
      (data as AdminSetting[]).forEach((s) => { vals[s.key] = s.value; });
      setEditValues(vals);
    }
    setLoading(false);
  }

  async function saveSetting(key: string) {
    const value = editValues[key];
    if (value === undefined) return;
    setSaving((p) => ({ ...p, [key]: true }));
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) {
      showMessage("error", error.message);
    } else {
      setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
      showMessage("success", `"${KNOWN_SETTINGS[key]?.label ?? key}" saved.`);
    }
    setSaving((p) => ({ ...p, [key]: false }));
  }

  async function addSetting() {
    if (!selectedKey || newValue.trim() === "") {
      showMessage("error", "Select a setting and enter a value.");
      return;
    }
    setAddingNew(true);
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: selectedKey, value: newValue.trim() }, { onConflict: "key" });
    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", `"${KNOWN_SETTINGS[selectedKey]?.label ?? selectedKey}" added.`);
      setSelectedKey("");
      setNewValue("");
      fetchSettings();
    }
    setAddingNew(false);
  }

  async function deleteSetting(key: string) {
    if (!confirm(`Delete "${KNOWN_SETTINGS[key]?.label ?? key}"?`)) return;
    const { error } = await supabase.from("admin_settings").delete().eq("key", key);
    if (!error) {
      setSettings((prev) => prev.filter((s) => s.key !== key));
      setEditValues((prev) => { const n = { ...prev }; delete n[key]; return n; });
      showMessage("success", "Setting removed.");
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const existingKeys = new Set(settings.map((s) => s.key));
  const addableKeys = Object.keys(KNOWN_SETTINGS).filter((k) => !existingKeys.has(k));
  const selectedMeta = selectedKey ? KNOWN_SETTINGS[selectedKey] : null;

  // Split settings into core and custom
  const coreSettings = settings.filter((s) => CORE_KEYS.has(s.key));
  const customSettings = settings.filter((s) => !CORE_KEYS.has(s.key));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Settings</h1>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium transition-all ${message.type === "success" ? "bg-success" : "bg-error"}`}>
          {message.text}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Core Settings */}
        <section>
          <h2 className="font-heading text-xl font-bold text-primary mb-1">Core Settings</h2>
          <p className="text-text-muted text-sm mb-4">Required settings that control ordering behaviour.</p>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {coreSettings.map((s) => <SettingRow key={s.key} setting={s} editValues={editValues} setEditValues={setEditValues} saving={saving} onSave={saveSetting} onDelete={deleteSetting} isCore />)}
              {coreSettings.length === 0 && <p className="text-text-muted text-sm">No core settings found — run the seed SQL.</p>}
            </div>
          )}
        </section>

        {/* Custom Settings */}
        <section>
          <h2 className="font-heading text-xl font-bold text-primary mb-1">Custom Settings</h2>
          <p className="text-text-muted text-sm mb-4">Optional settings you can enable for this store.</p>
          {!loading && customSettings.length > 0 && (
            <div className="space-y-3 mb-4">
              {customSettings.map((s) => <SettingRow key={s.key} setting={s} editValues={editValues} setEditValues={setEditValues} saving={saving} onSave={saveSetting} onDelete={deleteSetting} />)}
            </div>
          )}

          {/* Add from known settings dropdown */}
          {addableKeys.length > 0 && (
            <div className="card p-5 border-2 border-dashed border-primary/20">
              <h3 className="font-semibold text-text-main mb-3">Add a Setting</h3>

              {/* Dropdown */}
              <div className="mb-3">
                <label className="label text-xs">Setting</label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="input"
                >
                  <option value="">— Choose a setting —</option>
                  {addableKeys.map((k) => (
                    <option key={k} value={k}>
                      {KNOWN_SETTINGS[k].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description + value input once selected */}
              {selectedMeta && (
                <>
                  <p className="text-text-muted text-xs mb-3 bg-primary/5 rounded-lg px-3 py-2">
                    {selectedMeta.description}
                  </p>
                  <div className="mb-3">
                    <label className="label text-xs">
                      Value{selectedMeta.unit ? ` (${selectedMeta.unit})` : ""}
                    </label>
                    <input
                      type={selectedMeta.type === "number" ? "number" : "text"}
                      min={selectedMeta.min}
                      max={selectedMeta.max}
                      placeholder={selectedMeta.placeholder}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="input"
                    />
                  </div>
                </>
              )}

              <button
                onClick={addSetting}
                disabled={addingNew || !selectedKey}
                className="btn-primary w-full"
              >
                {addingNew ? "Adding..." : selectedKey ? `+ Add "${KNOWN_SETTINGS[selectedKey].label}"` : "+ Add Setting"}
              </button>
            </div>
          )}

          {addableKeys.length === 0 && !loading && (
            <p className="text-text-muted text-sm">All available settings have been added.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function SettingRow({
  setting, editValues, setEditValues, saving, onSave, onDelete, isCore = false,
}: {
  setting: AdminSetting;
  editValues: Record<string, string>;
  setEditValues: (v: Record<string, string>) => void;
  saving: Record<string, boolean>;
  onSave: (key: string) => void;
  onDelete: (key: string) => void;
  isCore?: boolean;
}) {
  const meta = KNOWN_SETTINGS[setting.key];
  const current = editValues[setting.key] ?? setting.value;
  const isDirty = current !== setting.value;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-main">{meta?.label ?? setting.key}</h3>
            {meta?.unit && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {meta.unit}
              </span>
            )}
          </div>
          {meta?.description && (
            <p className="text-text-muted text-xs mt-0.5">{meta.description}</p>
          )}
          {!meta && (
            <p className="text-text-muted text-xs mt-0.5 font-mono">{setting.key}</p>
          )}
        </div>
        {!isCore && (
          <button
            onClick={() => onDelete(setting.key)}
            className="text-error/40 hover:text-error ml-4 flex-shrink-0 transition-colors"
            title="Remove setting"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <input
          type={meta?.type === "number" ? "number" : "text"}
          min={meta?.min}
          max={meta?.max}
          placeholder={meta?.placeholder}
          value={current}
          onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
          className="input flex-1"
        />
        <button
          onClick={() => onSave(setting.key)}
          disabled={saving[setting.key] || !isDirty}
          className="btn-primary px-5 flex-shrink-0"
        >
          {saving[setting.key] ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
