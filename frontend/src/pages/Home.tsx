import { useEffect, useState } from "react";
import { useCartStore } from "../store/cartStore";
import { supabase } from "../lib/supabase";
import type { Sku } from "../types";
import { pageCache } from "../lib/pageCache";

export default function Home() {
  const [skus, setSkus] = useState<Sku[]>(() => pageCache.get<Sku[]>('home-skus') ?? []);
  const [loading, setLoading] = useState(!pageCache.get('home-skus'));
  const [storeMinValue, setStoreMinValue] = useState(0);
  const [storeMinEnabled, setStoreMinEnabled] = useState(false);

  useEffect(() => {
    async function load() {
      if (!pageCache.get('home-skus')) setLoading(true);
      try {
        const [skusRes, settingsRes] = await Promise.all([
          supabase.from("skus").select("*").eq("is_active", true)
            .order("is_promo", { ascending: false })
            .order("sort_order", { ascending: true }),
          supabase.from("admin_settings").select("key, value")
            .in("key", ["store_min_order_value", "store_min_order_value_enabled"]),
        ]);

        if (skusRes.data) {
          setSkus(skusRes.data as Sku[]);
          pageCache.set('home-skus', skusRes.data);
        }

        if (settingsRes.data) {
          setStoreMinEnabled(settingsRes.data.find((s) => s.key === "store_min_order_value_enabled")?.value === "true");
          setStoreMinValue(parseFloat(settingsRes.data.find((s) => s.key === "store_min_order_value")?.value ?? "0") || 0);
        }
      } catch (e) {
        console.error("Failed to load products:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const productMinQty = skus.length > 0 ? Math.min(...skus.map((s) => s.min_qty ?? 6)) : null;
  const activeStoreMin = storeMinEnabled && storeMinValue > 0;

  const minOrderStat = activeStoreMin
    ? { label: "Min. Order", value: `S$${storeMinValue.toFixed(2)}` }
    : productMinQty
    ? { label: "Min. Order", value: `${productMinQty} sets` }
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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

        <div className="flex justify-center gap-8 mt-8 mb-2">
          {[
            { label: "Made Fresh", value: "Daily" },
            { label: "Delivery Slots", value: "2 Slots/Day" },
            ...(minOrderStat ? [minOrderStat] : []),
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading font-bold text-2xl text-primary">{stat.value}</p>
              <p className="text-text-muted text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <p className="text-text-muted text-sm mt-3">Island-wide delivery across Singapore</p>
      </section>

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
      ) : skus.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <span className="text-5xl block mb-4">🍞</span>
          <p className="font-medium">No products available right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {skus.map((sku) => (
            <SkuCard
              key={sku.id}
              sku={sku}
              storeMinValue={activeStoreMin ? storeMinValue : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkuCard({ sku, storeMinValue }: { sku: Sku; storeMinValue: number }) {
  const { items, addItem, updateQuantity, removeItem } = useCartStore();
  const cartItem = items.find((i) => i.sku.id === sku.id);
  const cartQty = cartItem?.quantity ?? 0;
  const minQty = sku.min_qty ?? 6;

  // When adding for the first time, add enough to clear both the per-product minimum
  // and the store minimum order value (whichever requires more sets).
  const addQty = storeMinValue > 0
    ? Math.max(minQty, Math.ceil(storeMinValue / sku.price))
    : minQty;

  return (
    <div className="card flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <div className="w-full h-44 bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center relative overflow-hidden">
        {sku.image_url ? (
          <img src={sku.image_url} alt={sku.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl">🍞</span>
        )}
        {sku.is_bundle && (
          <span className="absolute top-2 right-2 bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
            Bundle
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {sku.is_promo && (
          <span className="text-xs text-accent-dark font-semibold uppercase tracking-wide mb-1">
            Promo
          </span>
        )}
        <h3 className="font-heading font-semibold text-lg text-text-main mb-1 leading-snug">
          {sku.name}
        </h3>
        {sku.description && (
          <p className="text-text-muted text-sm flex-1 leading-relaxed">
            {sku.description}
          </p>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary/10">
          <div>
            <p className="font-heading font-bold text-xl text-primary">
              S${sku.price.toFixed(2)}
              {!sku.is_bundle && (
                <span className="text-xs font-normal text-text-muted ml-1">/set</span>
              )}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Min. {minQty} sets</p>
          </div>

          {cartQty === 0 ? (
            <button
              onClick={() => addItem(sku, addQty)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-button font-semibold text-sm bg-primary text-white hover:bg-primary-dark transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {addQty}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => cartQty <= minQty ? removeItem(sku.id) : updateQuantity(sku.id, cartQty - 1)}
                className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-bold flex items-center justify-center transition-colors"
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-text-main">{cartQty}</span>
              <button
                onClick={() => updateQuantity(sku.id, cartQty + 1)}
                className="w-8 h-8 rounded-full bg-primary text-white font-bold flex items-center justify-center hover:bg-primary-dark transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
