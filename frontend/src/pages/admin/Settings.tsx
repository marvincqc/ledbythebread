import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { pageCache } from "../../lib/pageCache";

export default function AdminSettings() {
  const [minItemQty, setMinItemQty] = useState("6");
  const [minItemQtySaved, setMinItemQtySaved] = useState("6");
  const [storeOverrideEnabled, setStoreOverrideEnabled] = useState(false);

  const [loading, setLoading] = useState(!pageCache.get('admin-settings'));
  const [savingQty, setSavingQty] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    if (!pageCache.get('admin-settings')) setLoading(true);
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("*")
        .in("key", ["min_item_qty", "store_min_qty_enabled"]);
      if (data) {
        const qty = data.find((s) => s.key === "min_item_qty")?.value ?? "6";
        const override = data.find((s) => s.key === "store_min_qty_enabled")?.value === "true";
        setMinItemQty(qty);
        setMinItemQtySaved(qty);
        setStoreOverrideEnabled(override);
        pageCache.set('admin-settings', data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveMinQty() {
    setSavingQty(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "min_item_qty", value: minItemQty }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setMinItemQtySaved(minItemQty); showMessage("success", "Minimum order quantity saved."); }
    } finally {
      setSavingQty(false);
    }
  }

  async function toggleOverride() {
    const next = !storeOverrideEnabled;
    setSavingToggle(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "store_min_qty_enabled", value: String(next) }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else {
        setStoreOverrideEnabled(next);
        showMessage("success", next ? "Store override enabled." : "Store override disabled.");
      }
    } finally {
      setSavingToggle(false);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const qtyDirty = minItemQty !== minItemQtySaved;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Settings</h1>
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

            {/* Store minimum order quantity */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-main">Store Minimum Order Quantity</h3>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">sets</span>
                  </div>
                  <p className="text-text-muted text-xs mt-0.5">
                    Overrides per-product minimums only when this value is higher. Requires override to be enabled below.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  placeholder="6"
                  value={minItemQty}
                  onChange={(e) => setMinItemQty(e.target.value)}
                  className="input flex-1"
                />
                <button
                  onClick={saveMinQty}
                  disabled={savingQty || !qtyDirty}
                  className="btn-primary px-5 flex-shrink-0"
                >
                  {savingQty ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* Store override toggle */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-text-main">Store Override</h3>
                  <p className="text-text-muted text-xs mt-0.5">
                    When active, the store minimum above overrides per-product minimums if it is higher.
                  </p>
                </div>
                <button
                  onClick={toggleOverride}
                  disabled={savingToggle}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    storeOverrideEnabled ? "bg-green-500" : "bg-gray-300"
                  } disabled:opacity-60`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    storeOverrideEnabled ? "left-6" : "left-0.5"
                  }`} />
                </button>
              </div>
              <p className={`text-xs font-medium mt-3 ${storeOverrideEnabled ? "text-green-600" : "text-text-muted"}`}>
                {storeOverrideEnabled ? "Active — store minimum is in effect" : "Inactive — per-product minimums apply"}
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
