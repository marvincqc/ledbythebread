import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { pageCache } from "../../lib/pageCache";

function useSetting(initial = "") {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  return { value, setValue, saved, setSaved, saving, setSaving };
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{label}</p>;
}

export default function AdminSettings() {
  const minVal    = useSetting("0.00");
  const [minEnabled, setMinEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  const uen       = useSetting();
  const weeks     = useSetting("2");

  const [loading, setLoading] = useState(!pageCache.get("admin-settings"));
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    if (!pageCache.get("admin-settings")) setLoading(true);
    try {
      const { data } = await supabase.from("admin_settings").select("key, value")
        .in("key", ["store_min_order_value", "store_min_order_value_enabled", "paynow_uen", "max_weeks_out"]);
      if (data) {
        const get = (k: string, fallback = "") => data.find((s) => s.key === k)?.value ?? fallback;
        minVal.setValue(get("store_min_order_value", "0.00"));
        minVal.setSaved(get("store_min_order_value", "0.00"));
        setMinEnabled(get("store_min_order_value_enabled") === "true");
        uen.setValue(get("paynow_uen"));
        uen.setSaved(get("paynow_uen"));
        weeks.setValue(get("max_weeks_out", "2"));
        weeks.setSaved(get("max_weeks_out", "2"));
        pageCache.set("admin-settings", data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(
    key: string,
    value: string,
    setSaving: (v: boolean) => void,
    setSaved: (v: string) => void,
    successMsg: string,
    validate?: () => string | null
  ) {
    if (validate) {
      const err = validate();
      if (err) { showMessage("error", err); return; }
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setSaved(value); showMessage("success", successMsg); }
    } finally {
      setSaving(false);
    }
  }

  async function toggleMinOrderValue() {
    const next = !minEnabled;
    setSavingToggle(true);
    try {
      const { error } = await supabase.from("admin_settings")
        .upsert({ key: "store_min_order_value_enabled", value: String(next) }, { onConflict: "key" });
      if (error) { showMessage("error", error.message); }
      else { setMinEnabled(next); showMessage("success", next ? "Minimum order value activated." : "Minimum order value deactivated."); }
    } finally {
      setSavingToggle(false);
    }
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
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={minVal.value}
                      onChange={(e) => minVal.setValue(e.target.value)}
                      className="input pl-9"
                    />
                  </div>
                  <button
                    onClick={() => save(
                      "store_min_order_value",
                      parseFloat(minVal.value).toFixed(2),
                      minVal.setSaving,
                      minVal.setSaved,
                      "Minimum order value saved.",
                      () => (isNaN(parseFloat(minVal.value)) || parseFloat(minVal.value) < 0) ? "Enter a valid amount." : null
                    )}
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
                  <input
                    type="text" placeholder="e.g. 202312345A or +65 9123 4567"
                    value={uen.value}
                    onChange={(e) => uen.setValue(e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    onClick={() => save("paynow_uen", uen.value.trim(), uen.setSaving, uen.setSaved, "PayNow UEN saved.")}
                    disabled={uen.saving || uen.value === uen.saved}
                    className="btn-primary px-5 flex-shrink-0"
                  >
                    {uen.saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div>
              <SectionLabel label="Delivery" />
              <div className="card p-5">
                <h3 className="font-semibold text-text-main mb-0.5">Booking Window</h3>
                <p className="text-text-muted text-xs mb-4">How many weeks ahead customers can pre-order.</p>
                <div className="flex gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="number" min="1" max="12"
                      value={weeks.value}
                      onChange={(e) => weeks.setValue(e.target.value)}
                      className="input w-24"
                    />
                    <span className="text-sm text-text-muted">weeks</span>
                  </div>
                  <button
                    onClick={() => save(
                      "max_weeks_out",
                      String(Math.min(12, Math.max(1, parseInt(weeks.value) || 2))),
                      weeks.setSaving,
                      weeks.setSaved,
                      "Booking window saved.",
                      () => {
                        const v = parseInt(weeks.value);
                        return (isNaN(v) || v < 1 || v > 12) ? "Enter a number between 1 and 12." : null;
                      }
                    )}
                    disabled={weeks.saving || weeks.value === weeks.saved}
                    className="btn-primary px-5 flex-shrink-0"
                  >
                    {weeks.saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
