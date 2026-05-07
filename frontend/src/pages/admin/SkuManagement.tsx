import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { Sku, Category } from "../../types";

interface SkuFormData {
  name: string;
  description: string;
  price: string;
  category_id: string;
  image_url: string;
  is_bundle: boolean;
  is_active: boolean;
}

const defaultForm: SkuFormData = {
  name: "",
  description: "",
  price: "",
  category_id: "",
  image_url: "",
  is_bundle: false,
  is_active: true,
};

export default function SkuManagement() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [form, setForm] = useState<SkuFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [skuRes, catRes] = await Promise.all([
      supabase
        .from("skus")
        .select("*, category:categories(*)")
        .order("created_at", { ascending: true }),
      supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (skuRes.data) setSkus(skuRes.data as unknown as Sku[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    setLoading(false);
  }

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
      category_id: sku.category_id ?? "",
      image_url: sku.image_url ?? "",
      is_bundle: sku.is_bundle,
      is_active: sku.is_active,
    });
    setModalOpen(true);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(filename, file, { upsert: true });
    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filename);
    setForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) {
      showMessage("error", "Name and price are required.");
      return;
    }

    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      showMessage("error", "Price must be a positive number.");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      category_id: form.category_id || null,
      image_url: form.image_url.trim() || null,
      is_bundle: form.is_bundle,
      is_active: form.is_active,
    };

    if (editingSku) {
      const { error } = await supabase
        .from("skus")
        .update(payload)
        .eq("id", editingSku.id);

      if (error) {
        showMessage("error", error.message);
      } else {
        showMessage("success", "Product updated.");
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("skus").insert(payload);

      if (error) {
        showMessage("error", error.message);
      } else {
        showMessage("success", "Product created.");
        setModalOpen(false);
        fetchData();
      }
    }

    setSaving(false);
  }

  async function toggleActive(sku: Sku) {
    const { error } = await supabase
      .from("skus")
      .update({ is_active: !sku.is_active })
      .eq("id", sku.id);

    if (!error) {
      setSkus((prev) =>
        prev.map((s) =>
          s.id === sku.id ? { ...s, is_active: !sku.is_active } : s
        )
      );
      showMessage("success", sku.is_active ? "Product deactivated." : "Product activated.");
    } else {
      showMessage("error", error.message);
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  const filtered = skus.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-white/70 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <h1 className="font-heading text-xl font-bold">Product Management</h1>
        </div>
        <button onClick={openCreate} className="bg-white text-primary font-semibold px-4 py-2 rounded-button hover:bg-white/90 transition-colors text-sm">
          + Add Product
        </button>
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

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input max-w-xs"
          />
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
                  {["Product", "Category", "Price", "Bundle", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-text-muted text-xs font-medium uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-text-muted">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sku) => (
                    <tr key={sku.id} className={`hover:bg-background/50 ${!sku.is_active ? "opacity-50" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            {sku.image_url ? (
                              <img src={sku.image_url} alt={sku.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <span>🍞</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-text-main">{sku.name}</p>
                            {sku.description && (
                              <p className="text-text-muted text-xs truncate max-w-[200px]">
                                {sku.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-muted">
                        {sku.category?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 font-semibold text-primary">
                        S${sku.price.toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        {sku.is_bundle ? (
                          <span className="badge bg-accent/20 text-accent-dark">Bundle</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`badge ${
                            sku.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {sku.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(sku)}
                            className="text-primary hover:text-primary-dark font-medium text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(sku)}
                            className={`font-medium text-xs ${
                              sku.is_active
                                ? "text-error/70 hover:text-error"
                                : "text-success hover:text-success"
                            }`}
                          >
                            {sku.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
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
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="Classic Pandesal"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input resize-none"
                  rows={2}
                  placeholder="Short product description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (S$) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="input"
                    placeholder="12.00"
                  />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="input"
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Image</label>
                <div className="space-y-2">
                  {/* File upload button */}
                  <label className={`flex items-center gap-2 cursor-pointer w-fit px-3 py-2 rounded-button border border-primary/30 text-sm font-medium text-primary hover:bg-primary/5 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                    {uploading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload from computer
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {/* Upload error */}
                  {uploadError && (
                    <p className="text-xs text-error">{uploadError}</p>
                  )}

                  {/* URL input */}
                  <div>
                    <span className="text-xs text-text-muted mb-1 block">Or paste image URL</span>
                    <input
                      type="url"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="input"
                      placeholder="https://..."
                    />
                  </div>

                  {/* Thumbnail preview */}
                  {form.image_url && (
                    <div className="mt-1">
                      <img
                        src={form.image_url}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-lg border border-primary/20"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_bundle}
                    onChange={(e) => setForm({ ...form, is_bundle: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium">Bundle product</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium">Active (visible)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary">
                {saving ? "Saving..." : editingSku ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
