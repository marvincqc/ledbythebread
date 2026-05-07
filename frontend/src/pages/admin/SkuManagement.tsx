import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Sku } from "../../types";
import { pageCache } from "../../lib/pageCache";

interface SkuFormData {
  name: string;
  description: string;
  price: string;
  image_url: string;
  is_bundle: boolean;
  is_active: boolean;
  is_promo: boolean;
}

const defaultForm: SkuFormData = {
  name: "", description: "", price: "", image_url: "",
  is_bundle: false, is_active: true, is_promo: false,
};

export default function SkuManagement() {
  const [skus, setSkus] = useState<Sku[]>(() => pageCache.get<Sku[]>('admin-skus') ?? []);
  const [savedSkus, setSavedSkus] = useState<Sku[]>(() => pageCache.get<Sku[]>('admin-skus') ?? []); // last saved state for discard
  const [loading, setLoading] = useState(!pageCache.get('admin-skus'));
  const [saving, setSavingState] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [form, setForm] = useState<SkuFormData>(defaultForm);
  const [modalSaving, setModalSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Dirty tracking: compare current skus to savedSkus
  const isDirty = useCallback(() => {
    if (skus.length !== savedSkus.length) return true;
    return skus.some((s, i) => {
      const saved = savedSkus.find((ss) => ss.id === s.id);
      if (!saved) return true;
      return (
        s.sort_order !== saved.sort_order ||
        s.is_promo !== saved.is_promo ||
        s.is_active !== saved.is_active
      );
    });
  }, [skus, savedSkus]);

  const dirty = isDirty();

  useEffect(() => { fetchData(); }, []);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function fetchData() {
    if (!pageCache.get('admin-skus')) setLoading(true);
    const { data } = await supabase
      .from("skus")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) {
      setSkus(data as Sku[]);
      setSavedSkus(data as Sku[]);
      pageCache.set('admin-skus', data);
    }
    setLoading(false);
  }

  // ── Save all pending changes ────────────────────────────────
  async function saveAll() {
    setSavingState(true);
    const changed = skus.filter((s) => {
      const saved = savedSkus.find((ss) => ss.id === s.id);
      return saved && (
        s.sort_order !== saved.sort_order ||
        s.is_promo !== saved.is_promo ||
        s.is_active !== saved.is_active
      );
    });
    if (changed.length === 0) { setSavingState(false); return; }
    const results = await Promise.all(
      changed.map((s) =>
        supabase.from("skus")
          .update({ sort_order: s.sort_order, is_promo: s.is_promo, is_active: s.is_active })
          .eq("id", s.id)
      )
    );
    const failed = results.filter((r) => r.error);
    if (failed.length) {
      showMessage("error", "Some changes failed to save. Please try again.");
    } else {
      setSavedSkus([...skus]);
      showMessage("success", "All changes saved.");
    }
    setSavingState(false);
  }

  function discardAll() {
    setSkus([...savedSkus]);
  }

  // ── Drag and drop ──────────────────────────────────────────
  function onDragStart(id: string) { dragId.current = id; }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setDragOverId(id);
  }

  function onDrop(targetId: string) {
    const from = dragId.current;
    setDragOverId(null);
    dragId.current = null;
    if (!from || from === targetId) return;

    setSkus((prev) => {
      const reordered = [...prev];
      const fromIdx = reordered.findIndex((s) => s.id === from);
      const toIdx = reordered.findIndex((s) => s.id === targetId);
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      // Reassign sort_order based on new positions
      return reordered.map((s, i) => ({ ...s, sort_order: i + 1 }));
    });
  }

  // ── Inline toggles (local only — saved via Save Changes bar) ──
  function togglePromo(id: string) {
    setSkus((prev) => prev.map((s) => s.id === id ? { ...s, is_promo: !s.is_promo } : s));
  }

  function toggleActive(id: string) {
    setSkus((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !s.is_active } : s));
  }

  // ── Delete (immediate — destructive) ──────────────────────
  async function deleteSku(sku: Sku) {
    if (!confirm(`Delete "${sku.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("skus").delete().eq("id", sku.id);
    if (!error) {
      const updated = skus.filter((s) => s.id !== sku.id);
      setSkus(updated);
      setSavedSkus(updated);
      pageCache.set('admin-skus', updated);
      showMessage("success", `"${sku.name}" deleted.`);
    } else {
      showMessage("error", error.message);
    }
  }

  // ── Modal add/edit (immediate save — in modal context) ────
  function openCreate() {
    setEditingSku(null);
    setForm(defaultForm);
    setUploadError(null);
    setModalOpen(true);
  }

  function openEdit(sku: Sku) {
    setEditingSku(sku);
    setUploadError(null);
    setForm({
      name: sku.name,
      description: sku.description ?? "",
      price: String(sku.price),
      image_url: sku.image_url ?? "",
      is_bundle: sku.is_bundle,
      is_active: sku.is_active,
      is_promo: sku.is_promo,
    });
    setModalOpen(true);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("product-images").upload(filename, file, { upsert: true });
    if (error) { setUploadError(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filename);
    setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  async function handleModalSave() {
    if (!form.name.trim() || !form.price) {
      showMessage("error", "Name and price are required.");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      showMessage("error", "Price must be a positive number.");
      return;
    }
    setModalSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      image_url: form.image_url.trim() || null,
      is_bundle: form.is_bundle,
      is_active: form.is_active,
      is_promo: form.is_promo,
    };

    if (editingSku) {
      const { error } = await supabase.from("skus").update(payload).eq("id", editingSku.id);
      if (error) { showMessage("error", error.message); }
      else { showMessage("success", "Product updated."); setModalOpen(false); fetchData(); }
    } else {
      const maxOrder = skus.length ? Math.max(...skus.map((s) => s.sort_order)) : 0;
      const { data, error } = await supabase
        .from("skus")
        .insert({ ...payload, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) { showMessage("error", error.message); }
      else {
        showMessage("success", "Product created.");
        setModalOpen(false);
        fetchData();
      }
    }
    setModalSaving(false);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const filtered = skus.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Count changes for the save bar
  const changeCount = skus.reduce((n, s) => {
    const saved = savedSkus.find((ss) => ss.id === s.id);
    if (!saved) return n;
    if (s.sort_order !== saved.sort_order || s.is_promo !== saved.is_promo || s.is_active !== saved.is_active) return n + 1;
    return n;
  }, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
          <h1 className="font-heading text-xl font-bold">Product Management</h1>
        </div>
        <button onClick={openCreate} className="bg-white text-primary font-semibold px-4 py-2 rounded-button hover:bg-white/90 text-sm">
          + Add Product
        </button>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${message.type === "success" ? "bg-success" : "bg-error"}`}>
          {message.text}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input max-w-xs"
          />
          <p className="text-text-muted text-sm">Drag ☰ to reorder</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  {["", "Product", "Price", "Bundle", "Promo", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-text-muted text-xs font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-text-muted">No products found.</td>
                  </tr>
                ) : (
                  filtered.map((sku) => {
                    const saved = savedSkus.find((s) => s.id === sku.id);
                    const hasChanges = saved && (
                      sku.sort_order !== saved.sort_order ||
                      sku.is_promo !== saved.is_promo ||
                      sku.is_active !== saved.is_active
                    );
                    return (
                      <tr
                        key={sku.id}
                        draggable
                        onDragStart={() => onDragStart(sku.id)}
                        onDragOver={(e) => onDragOver(e, sku.id)}
                        onDrop={() => onDrop(sku.id)}
                        onDragEnd={() => setDragOverId(null)}
                        className={`transition-colors ${dragOverId === sku.id ? "bg-primary/10" : "hover:bg-background/50"} ${hasChanges ? "bg-yellow-50/60" : ""}`}
                      >
                        {/* Drag handle */}
                        <td className="px-3 py-3 cursor-grab active:cursor-grabbing">
                          <svg className="w-4 h-4 text-text-muted/40" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
                          </svg>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent/20 rounded-lg flex-shrink-0 overflow-hidden">
                              {sku.image_url
                                ? <img src={sku.image_url} alt={sku.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center"><span>🍞</span></div>}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-text-main">{sku.name}</p>
                                {hasChanges && <span className="text-xs text-warning font-medium">•</span>}
                              </div>
                              {sku.description && (
                                <p className="text-text-muted text-xs truncate max-w-[180px]">{sku.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary">S${sku.price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {sku.is_bundle
                            ? <span className="badge bg-accent/20 text-accent-dark">Bundle</span>
                            : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={sku.is_promo}
                            onChange={() => togglePromo(sku.id)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleActive(sku.id)}
                            className={`badge cursor-pointer transition-opacity hover:opacity-70 ${sku.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                          >
                            {sku.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => openEdit(sku)} className="text-primary hover:text-primary-dark font-medium text-xs">Edit</button>
                            <button onClick={() => deleteSku(sku)} className="text-error/60 hover:text-error font-medium text-xs">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Sticky Save Bar ─────────────────────────────────── */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-primary/20 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-warning inline-block" />
              <span className="text-text-muted">
                <span className="font-semibold text-text-main">{changeCount} product{changeCount !== 1 ? "s" : ""}</span> with unsaved changes
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={discardAll}
                disabled={saving}
                className="text-sm text-text-muted hover:text-error font-medium transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="btn-primary px-6 py-2 text-sm flex items-center gap-2"
              >
                {saving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                ) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setModalOpen(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-card shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-heading text-xl font-semibold text-primary mb-5">
              {editingSku ? "Edit Product" : "Add New Product"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Product Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Classic Pandesal" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input resize-none" rows={2} placeholder="Short description..." />
              </div>
              <div>
                <label className="label">Price (S$) *</label>
                <input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" placeholder="1.50" />
              </div>
              <div>
                <label className="label">Image</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 cursor-pointer w-fit px-3 py-2 rounded-button border border-primary/30 text-sm font-medium text-primary hover:bg-primary/5 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                    {uploading
                      ? <><span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />Uploading...</>
                      : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload from computer</>}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                  </label>
                  {uploadError && <p className="text-xs text-error">{uploadError}</p>}
                  <div>
                    <span className="text-xs text-text-muted mb-1 block">Or paste image URL</span>
                    <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="input" placeholder="https://..." />
                  </div>
                  {form.image_url && (
                    <img src={form.image_url} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-primary/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_bundle} onChange={(e) => setForm({ ...form, is_bundle: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Bundle</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_promo} onChange={(e) => setForm({ ...form, is_promo: e.target.checked })} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Promo</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={handleModalSave} disabled={modalSaving} className="flex-1 btn-primary">
                {modalSaving ? "Saving..." : editingSku ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
