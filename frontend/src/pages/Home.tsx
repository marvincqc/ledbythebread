import { useEffect, useState } from "react";
import { useCartStore } from "../store/cartStore";
import { supabase } from "../lib/supabase";
import type { Category, Sku } from "../types";

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { addItem, openCart } = useCartStore();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [catRes, skuRes] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("skus")
          .select("*, category:categories(*)")
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
      ]);

      if (catRes.data) setCategories(catRes.data as Category[]);
      if (skuRes.data) setSkus(skuRes.data as unknown as Sku[]);
      setLoading(false);
    }

    load();
  }, []);

  const filtered =
    activeCategory === "all"
      ? skus
      : skus.filter((s) => s.category_id === activeCategory);

  const handleAdd = (sku: Sku) => {
    addItem(sku);
    setAddedIds((prev) => new Set(prev).add(sku.id));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(sku.id);
        return next;
      });
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero */}
      <section className="mb-10 text-center">
        <div className="inline-block bg-accent/20 text-accent-dark font-semibold text-sm px-4 py-1 rounded-full mb-4">
          Fresh Baked in Singapore · Delivered to Your Door
        </div>
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
          Freshly Baked<br />
          <span className="text-accent">Pandesal</span> Delivered
        </h1>
        <p className="text-text-muted text-lg max-w-xl mx-auto">
          Home-baked Filipino bread rolls, made fresh daily in Singapore.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-8">
          {[
            { label: "Made Fresh", value: "Daily" },
            { label: "Delivery Slots", value: "2x/day" },
            { label: "Min. Order", value: "S$15" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading font-bold text-2xl text-primary">{stat.value}</p>
              <p className="text-text-muted text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-5 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
            activeCategory === "all"
              ? "bg-primary text-white shadow-sm"
              : "bg-white text-text-muted border border-primary/20 hover:border-primary/50"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-5 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-text-muted border border-primary/20 hover:border-primary/50"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* SKU grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="w-full h-44 bg-primary/10 rounded-lg mb-4" />
              <div className="h-5 bg-primary/10 rounded mb-2 w-3/4" />
              <div className="h-4 bg-primary/10 rounded mb-4 w-full" />
              <div className="h-10 bg-primary/10 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <span className="text-5xl block mb-4">🍞</span>
          <p className="font-medium">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((sku) => (
            <SkuCard
              key={sku.id}
              sku={sku}
              onAdd={() => handleAdd(sku)}
              justAdded={addedIds.has(sku.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkuCard({
  sku,
  onAdd,
  justAdded,
}: {
  sku: Sku;
  onAdd: () => void;
  justAdded: boolean;
}) {
  return (
    <div className="card flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="w-full h-44 bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center relative overflow-hidden">
        {sku.image_url ? (
          <img
            src={sku.image_url}
            alt={sku.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-6xl">🍞</span>
        )}
        {sku.is_bundle && (
          <span className="absolute top-2 right-2 bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
            Bundle
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {sku.category && (
          <span className="text-xs text-accent-dark font-semibold uppercase tracking-wide mb-1">
            {sku.category.name}
          </span>
        )}
        <h3 className="font-heading font-semibold text-lg text-text-main mb-1 leading-snug">
          {sku.name}
        </h3>
        {sku.description && (
          <p className="text-text-muted text-sm flex-1 leading-relaxed line-clamp-2">
            {sku.description}
          </p>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary/10">
          <p className="font-heading font-bold text-xl text-primary">
            S${sku.price.toFixed(2)}
            {!sku.is_bundle && (
              <span className="text-xs font-normal text-text-muted ml-1">/pc</span>
            )}
          </p>

          <button
            onClick={onAdd}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-button font-semibold text-sm transition-all active:scale-95 ${
              justAdded
                ? "bg-success text-white"
                : "bg-primary text-white hover:bg-primary-dark"
            }`}
          >
            {justAdded ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Added!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
