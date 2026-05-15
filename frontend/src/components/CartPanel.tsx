import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { supabase } from "../lib/supabase";
import { pageCache } from "../lib/pageCache";

export default function CartPanel() {
  const { items, updateQuantity, removeItem, closeCart, subtotal, totalItems } =
    useCartStore();
  const navigate = useNavigate();
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [minOrderValueEnabled, setMinOrderValueEnabled] = useState(false);

  useEffect(() => {
    type CartSettings = { min: number; enabled: boolean };
    const cached = pageCache.get<CartSettings>("cart-settings");
    if (cached) {
      setMinOrderValue(cached.min);
      setMinOrderValueEnabled(cached.enabled);
      return;
    }
    supabase.from("admin_settings").select("key, value")
      .in("key", ["store_min_order_value", "store_min_order_value_enabled"])
      .then(({ data }) => {
        if (!data) return;
        const min = parseFloat(data.find((s) => s.key === "store_min_order_value")?.value ?? "0") || 0;
        const enabled = data.find((s) => s.key === "store_min_order_value_enabled")?.value === "true";
        setMinOrderValue(min);
        setMinOrderValueEnabled(enabled);
        pageCache.set("cart-settings", { min, enabled });
      });
  }, []);

  const sub = subtotal();
  const total = totalItems();
  const belowMinItems = items.filter((i) => i.quantity < (i.sku.min_qty ?? 1));
  const belowMin = belowMinItems.length > 0;
  const belowMinValue = minOrderValueEnabled && sub < minOrderValue;

  const handleCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary/10">
          <h2 className="font-heading text-xl font-semibold text-primary">
            Your Cart
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-text-muted">
                ({total} {total === 1 ? "item" : "items"})
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 rounded-full hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <span className="text-6xl mb-4">🛒</span>
              <p className="text-text-muted font-medium">Your cart is empty</p>
              <p className="text-text-muted text-sm mt-1">
                Add some delicious pandesal to get started!
              </p>
              <button
                onClick={closeCart}
                className="mt-6 btn-primary"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.sku.id}
                className="flex gap-3 bg-background rounded-card p-3"
              >
                {/* Image placeholder */}
                <div className="w-16 h-16 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.sku.image_url ? (
                    <img
                      src={item.sku.image_url}
                      alt={item.sku.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">🍞</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-main text-sm truncate">
                    {item.sku.name}
                  </p>
                  <p className="text-primary font-semibold text-sm">
                    S${item.sku.price.toFixed(2)}{" "}
                  </p>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() =>
                        item.quantity <= (item.sku.min_qty ?? 1)
                          ? removeItem(item.sku.id)
                          : updateQuantity(item.sku.id, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg leading-none transition-colors"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.sku.id, item.quantity + 1)
                      }
                      className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary font-bold text-lg leading-none transition-colors"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>

                    <button
                      onClick={() => removeItem(item.sku.id)}
                      className="ml-auto text-error hover:text-error/70 transition-colors"
                      aria-label="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Line total */}
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-primary text-sm">
                    S${(item.sku.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-primary/10 px-5 py-4 space-y-3">
            {belowMin && (
              <div className="bg-error/10 border border-error/20 rounded-lg px-3 py-2 text-error text-sm">
                {belowMinItems.map((i) => `${i.sku.name} (min ${i.sku.min_qty ?? 1} sets)`).join(", ")} {belowMinItems.length === 1 ? "needs" : "need"} to meet the minimum.
              </div>
            )}
            {belowMinValue && (
              <div className="bg-error/10 border border-error/20 rounded-lg px-3 py-2 text-error text-sm">
                Minimum order value is S${minOrderValue.toFixed(2)}.
              </div>
            )}

            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-text-muted">Subtotal</span>
              <span className="font-bold text-xl text-primary">
                S${sub.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleCheckout}
              disabled={belowMin || belowMinValue}
              className="w-full btn-primary py-3 text-base"
            >
              Proceed to Checkout
            </button>

            <button
              onClick={closeCart}
              className="w-full btn-secondary py-2.5 text-sm"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
