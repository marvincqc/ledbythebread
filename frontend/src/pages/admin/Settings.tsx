import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { AdminSetting } from "../../types";
import { pageCache } from "../../lib/pageCache";

const CORE_SETTINGS: Record<string, { label: string; description: string; unit: string; min: number; max?: number; placeholder: string }> = {
  min_item_qty: {
    label: "Minimum Order Quantity",
    description: "Minimum quantity per item a customer must order.",
    unit: "sets",
    min: 1,
    placeholder: "6",
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSetting[]>(
    () => pageCache.get<{ settings: AdminSetting[]; editValues: Record<string, string> }>('admin-settings')?.settings ?? []
  );
  const [editValues, setEditValues] = useState<Record<string, string>>(
    () => pageCache.get<{ settings: AdminSetting[]; editValues: Record<string, string> }>('admin-settings')?.editValues ?? {}
  );
  const [loading, setLoading] = useState(!pageCache.get('admin-settings'));
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    if (!pageCache.get('admin-settings')) setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("*")
        .in("key", Object.keys(CORE_SETTINGS));
      if (data) {
        const freshSettings = data as AdminSetting[];
        const vals: Record<string, string> = {};
        freshSettings.forEach((s) => { vals[s.key] = s.value; });
        setSettings(freshSettings);
        setEditValues(vals);
        pageCache.set('admin-settings', { settings: freshSettings, editValues: vals });
      }
    } finally {
      setLoading(false);
    }
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
      showMessage("success", `"${CORE_SETTINGS[key]?.label}" saved.`);
    }
    setSaving((p) => ({ ...p, [key]: false }));
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  // Ensure all core keys are represented even if not in DB yet
  const rows = Object.keys(CORE_SETTINGS).map((key) => ({
    key,
    value: settings.find((s) => s.key === key)?.value ?? CORE_SETTINGS[key].placeholder,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Settings</h1>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${message.type === "success" ? "bg-success" : "bg-error"}`}>
          {message.text}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="font-heading text-2xl font-bold text-primary mb-2">Store Settings</h2>
        <p className="text-text-muted mb-8">These settings apply to the customer ordering flow.</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map(({ key, value }) => {
              const meta = CORE_SETTINGS[key];
              const current = editValues[key] ?? value;
              const saved = settings.find((s) => s.key === key)?.value ?? value;
              const isDirty = current !== saved;
              return (
                <div key={key} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-text-main">{meta.label}</h3>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{meta.unit}</span>
                      </div>
                      <p className="text-text-muted text-xs mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      min={meta.min}
                      max={meta.max}
                      placeholder={meta.placeholder}
                      value={current}
                      onChange={(e) => setEditValues({ ...editValues, [key]: e.target.value })}
                      className="input flex-1"
                    />
                    <button
                      onClick={() => saveSetting(key)}
                      disabled={saving[key] || !isDirty}
                      className="btn-primary px-5 flex-shrink-0"
                    >
                      {saving[key] ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
