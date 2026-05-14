import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import CartPanel from "./CartPanel";


const CartButton = ({ onClick, totalItems }: { onClick: () => void; totalItems: number }) => (
  <button
    onClick={onClick}
    className="relative p-2 rounded-full hover:bg-primary/10 transition-colors"
    aria-label={`Cart (${totalItems} items)`}
  >
    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
    {totalItems > 0 && (
      <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
        {totalItems > 99 ? "99+" : totalItems}
      </span>
    )}
  </button>
);

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems());
  const openCart = useCartStore((s) => s.openCart);
  const isCartOpen = useCartStore((s) => s.isOpen);
  const { user, isAdmin } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="bg-white shadow-sm sticky top-0 z-40 border-b border-primary/10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">

          <Link to="/" className="font-heading text-xl font-bold text-primary hover:text-primary-dark transition-colors">
            🍞 Led by the Bread
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/" className="text-text-muted hover:text-primary font-medium transition-colors text-sm">
              Menu
            </Link>

            {isAdmin && (
              <Link to="/admin" className="text-text-muted hover:text-primary font-medium transition-colors text-sm">
                Admin
              </Link>
            )}

            {!user && (
              <Link
                to="/admin/login"
                className="text-text-muted hover:text-primary font-medium transition-colors text-sm"
              >
                Admin Login
              </Link>
            )}

            <CartButton onClick={openCart} totalItems={totalItems} />
          </div>

          {/* Mobile: cart + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <CartButton onClick={openCart} totalItems={totalItems} />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-md hover:bg-primary/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-primary/10 px-4 py-3 space-y-1">
            <Link to="/" className="block py-2 text-text-muted hover:text-primary font-medium" onClick={() => setMobileMenuOpen(false)}>
              Menu
            </Link>
            {isAdmin && (
              <Link to="/admin" className="block py-2 text-text-muted hover:text-primary font-medium" onClick={() => setMobileMenuOpen(false)}>
                Admin Panel
              </Link>
            )}
            {!user && (
              <Link
                to="/admin/login"
                className="block py-2 text-text-muted hover:text-primary font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin Login
              </Link>
            )}
          </div>
        )}
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-primary text-white py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="font-heading text-lg font-semibold mb-1">Led by the Bread · Singapore Home Bakery</p>
          <p className="text-white/70 text-sm">Home-baked Filipino bread rolls, made fresh daily in Singapore.</p>
          <p className="text-white/50 text-xs mt-3">© {new Date().getFullYear()} Led by the Bread. All rights reserved.</p>
        </div>
      </footer>

      {isCartOpen && <CartPanel />}
    </div>
  );
}
