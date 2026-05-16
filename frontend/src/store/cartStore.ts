import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, Sku } from "../types";

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Actions
  addItem: (sku: Sku, quantity?: number) => void;
  removeItem: (skuId: string) => void;
  updateQuantity: (skuId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;

  // Computed (derived)
  totalItems: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (sku: Sku, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.sku.id === sku.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.sku.id === sku.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { sku, quantity }] };
        });
      },

      removeItem: (skuId: string) => {
        set((state) => ({
          items: state.items.filter((i) => i.sku.id !== skuId),
        }));
      },

      updateQuantity: (skuId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(skuId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.sku.id === skuId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.sku.price * i.quantity, 0),
    }),
    {
      name: "ledbythebread-cart",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
