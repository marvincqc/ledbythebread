import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { supabase } from "../lib/supabase";

export default function Cart() {
  const { items, updateQuantity, removeItem, subtotal, totalItems } = useCartStore();
  const navigate = useNavigate();
  const [storeMin, setStoreMin] = useState(6);
  const [storeOverride, setStoreOverride] = useState(false);

  useEffect(() => {
    supabase.from("admin_settings").select("key, value")
      .in("key", ["min_item_qty", "store_min_qty_enabled"])
      .then(({ data }) => {
        if (!data) return;
        setStoreMin(parseInt(data.find((s) => s.key === "min_item_qty")?.value ?? "6") || 6);
        setStoreOverride(data.find((s) => s.key === "store_min_qty_enabled")?.value === "true");
      });
  }, []);

  const effectiveMin = (sku: { min_qty?: number }) => {
    const productMin = sku.min_qty ?? 6;
    return storeOverride && storeMin > productMin ? storeMin : productMin;
  };

  const sub = subtotal();
  const total = totalItems();
  const belowMinItems = items.filter((i) => i.quantity < effectiveMin(i.sku));
  const belowMin = belowMinItems.length > 0;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="text-7xl block mb-4">🛒</span>
        <h2 className="font-heading text-2xl font-semibold text-primary mb-2">
          Your cart is empty
        </h2>
        <p className="text-text-muted mb-8">
          Head back to our menu and add some freshly baked pandesal!
        </p>
        <Link to="/" className="btn-primary">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary mb-6">
        Your Cart
        <span className="text-lg font-normal text-text-muted ml-2">
          ({total} {total === 1 ? "item" : "items"})
        </span>
      </h1>

      {/* Items */}
      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <div key={item.sku.id} className="card p-4 flex gap-4">
            {/* Image */}
            <div className="w-20 h-20 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {item.sku.image_url ? (
                <img
                  src={item.sku.image_url}
                  alt={item.sku.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">🍞</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-text-main truncate">{item.sku.name}</h3>
              <p className="text-primary font-medium text-sm">
                S${item.sku.price.toFixed(2)}
              </p>

              <div className="flex items-center gap-3 mt-3">
                {/* Qty controls */}
                <div className="flex items-center gap-2 bg-background rounded-lg px-2 py-1">
                  <button
                    onClick={() => updateQuantity(item.sku.id, item.quantity - 1)}
                    className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full font-bold text-lg transition-colors"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.sku.id, item.quantity + 1)}
                    className="w-7 h-7 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full font-bold text-lg transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => removeItem(item.sku.id)}
                  className="text-error/70 hover:text-error text-sm flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>
            </div>

            {/* Line total */}
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-primary text-lg">
                S${(item.sku.price * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary card */}
      <div className="card p-5 space-y-3">
        {/* Min order warning */}
        {belowMin && (
          <div className="flex items-start gap-2 bg-error/10 border border-error/20 rounded-lg px-3 py-2.5 text-error text-sm">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              {belowMinItems.map((i) => `${i.sku.name} (min ${effectiveMin(i.sku)} sets)`).join(", ")} {belowMinItems.length === 1 ? "needs" : "need"} to meet the minimum order quantity.
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-text-muted">Subtotal</span>
          <span className="font-bold text-2xl text-primary">S${sub.toFixed(2)}</span>
        </div>

        <p className="text-text-muted text-xs">
          Delivery fee determined at checkout based on your location.
        </p>

        <button
          onClick={() => navigate("/checkout")}
          disabled={belowMin}
          className="w-full btn-primary py-3 text-base"
        >
          Proceed to Checkout
        </button>

        <Link to="/" className="block w-full btn-secondary py-2.5 text-center text-sm">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
