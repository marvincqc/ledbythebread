import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import CartPanel from "./CartPanel";
import { WHATSAPP_LINK } from "../lib/constants";


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
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mt-3 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            +65 9180 3918
          </a>
          <p className="text-white/50 text-xs mt-3">© {new Date().getFullYear()} Led by the Bread. All rights reserved.</p>
        </div>
      </footer>

      {isCartOpen && <CartPanel />}
    </div>
  );
}
