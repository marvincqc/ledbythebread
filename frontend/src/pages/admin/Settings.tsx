import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { AdminSetting } from "../../types";

const SETTING_META: Record<string, { label: string; description: string; type: string; min?: number }> = {
  min_order_amount: {
    label: "Minimum Order Amount (S$)",
    description: "The minimum subtotal required to place an order.",
    type: "number",
    min: 0,
  },
  max_weeks_out: {
    label: "Maximum Weeks Out",
    description: "How many weeks in advance customers can pre-order.",
    type: "number",
    min: 1,
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New setting form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_settings")
      .select("*")
      .order("key", { ascending: true });

    if (data) {
      setSettings(data as AdminSetting[]);
      const vals: Record<string, string> = {};
      data.forEach((s: AdminSetting) => {
        vals[s.key] = s.value;
      });
      setEditValues(vals);
    }
    setLoading(false);
  }

  async function saveSetting(key: string) {
    const value = editValues[key];
    if (value === undefined) return;

    setSaving({ ...saving, [key]: true });

    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) {
      showMessage("error", error.message);
    } else {
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value } : s))
      );
      showMessage("success", `"${key}" saved.`);
    }

    setSaving({ ...saving, [key]: false });
  }

  async function addSetting() {
    if (!newKey.trim() || !newValue.trim()) {
      showMessage("error", "Key and value are required.");
      return;
    }

    setAddingNew(true);

    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: newKey.trim(), value: newValue.trim() }, { onConflict: "key" });

    if (error) {
      showMessage("error", error.message);
    } else {
      showMessage("success", `Setting "${newKey}" added.`);
      setNewKey("");
      setNewValue("");
      fetchSettings();
    }

    setAddingNew(false);
  }

  async function deleteSetting(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return;

    const { error } = await supabase
      .from("admin_settings")
      .delete()
      .eq("key", key);

    if (!error) {
      setSettings((prev) => prev.filter((s) => s.key !== key));
      showMessage("success", `Setting "${key}" deleted.`);
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
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Settings</h1>
      </header>

      {/* Toast */}
      {message && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${
            message.type === "success" ? "bg-success" : "bg-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="font-heading text-2xl font-bold text-primary mb-2">Admin Settings</h2>
        <p className="text-text-muted mb-8">
          Configure store-wide settings that control ordering behavior.
        </p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {settings.map((setting) => {
              const meta = SETTING_META[setting.key];
              return (
                <div key={setting.key} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-text-main">
                        {meta?.label ?? setting.key}
                      </h3>
                      {meta?.description && (
                        <p className="text-text-muted text-xs mt-0.5">{meta.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteSetting(setting.key)}
                      className="text-error/50 hover:text-error ml-4 flex-shrink-0"
                      title="Delete setting"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <input
                      type={meta?.type ?? "text"}
                      min={meta?.min}
                      value={editValues[setting.key] ?? setting.value}
                      onChange={(e) =>
                        setEditValues({ ...editValues, [setting.key]: e.target.value })
                      }
                      className="input flex-1"
                    />
                    <button
                      onClick={() => saveSetting(setting.key)}
                      disabled={
                        saving[setting.key] ||
                        editValues[setting.key] === setting.value
                      }
                      className="btn-primary px-5 flex-shrink-0 disabled:opacity-50"
                    >
                      {saving[setting.key] ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add new setting */}
            <div className="card p-5 border-dashed border-2 border-primary/20">
              <h3 className="font-semibold text-text-main mb-3">Add Custom Setting</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="label text-xs">Key</label>
                  <input
                    type="text"
                    placeholder="setting_key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label text-xs">Value</label>
                  <input
                    type="text"
                    placeholder="value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
              <button
                onClick={addSetting}
                disabled={addingNew}
                className="btn-primary w-full"
              >
                {addingNew ? "Adding..." : "+ Add Setting"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
