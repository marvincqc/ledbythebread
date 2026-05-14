import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { pageCache } from "../../lib/pageCache";

export default function AdminSettings() {
  const [minOrderValue, setMinOrderValue] = useState("0.00");
  const [minOrderValueSaved, setMinOrderValueSaved] = useState("0.00");
  const [minOrderValueEnabled, setMinOrderValueEnabled] = useState(false);

  const [loading, setLoading] = useState(!pageCache.get('admin-settings'));
  const [savingValue, setSavingValue] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    if (!pageCache.get('admin-settings')) setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", ["store_min_order_value", "store_min_order_value_enabled"]);
      if (data) {
        const val = data.find((s) => s.key === "store_min_order_value")?.value ?? "0.00";
        const enabled = data.find((s) => s.key === "store_min_order_value_enabled")?.value === "true";
        setMinOrderValue(val);
        setMinOrderValueSaved(val);
        setMinOrderValueEnabled(enabled);
        pageCache.set('admin-settings', data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveMinOrderValue() {
    const parsed = parseFloat(minOrderValue);
    if (isNaN(parsed) || parsed < 0) {
      showMessage("error", "Enter a valid dollar amount.");
      return;
    }
    const formatted = parsed.toFixed(2);
    setSavingValue(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "store_min_order_value", value: formatted }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setMinOrderValue(formatted); setMinOrderValueSaved(formatted); showMessage("success", "Minimum order value saved."); }
    } finally {
      setSavingValue(false);
    }
  }

  async function toggleMinOrderValue() {
    const next = !minOrderValueEnabled;
    setSavingToggle(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "store_min_order_value_enabled", value: String(next) }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else {
        setMinOrderValueEnabled(next);
        showMessage("success", next ? "Minimum order value activated." : "Minimum order value deactivated.");
      }
    } finally {
      setSavingToggle(false);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const isDirty = minOrderValue !== minOrderValueSaved;

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
        <h2 className="font-heading text-2xl font-bold text-primary mb-2">Store Settings</h2>
        <p className="text-text-muted mb-8">These settings apply to the customer ordering flow.</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">

            <div className="card p-5">
              <div className="mb-3">
                <h3 className="font-semibold text-text-main">Store Minimum Order Value</h3>
                <p className="text-text-muted text-xs mt-0.5">
                  Minimum cart total required to place an order. Only enforced when active.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-medium">S$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(e.target.value)}
                    className="input pl-9"
                  />
                </div>
                <button
                  onClick={saveMinOrderValue}
                  disabled={savingValue || !isDirty}
                  className="btn-primary px-5 flex-shrink-0"
                >
                  {savingValue ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text-main">Activate Minimum Order Value</h3>
                  <p className="text-text-muted text-xs mt-0.5">
                    When active, customers cannot check out below the minimum order value above.
                  </p>
                </div>
                <button
                  onClick={toggleMinOrderValue}
                  disabled={savingToggle}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    minOrderValueEnabled ? "bg-green-500" : "bg-gray-300"
                  } disabled:opacity-60`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    minOrderValueEnabled ? "left-6" : "left-0.5"
                  }`} />
                </button>
              </div>
              <p className={`text-xs font-medium mt-3 ${minOrderValueEnabled ? "text-green-600" : "text-text-muted"}`}>
                {minOrderValueEnabled
                  ? `Active — minimum order value of S$${parseFloat(minOrderValueSaved).toFixed(2)} is enforced`
                  : "Inactive — no minimum order value"}
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
