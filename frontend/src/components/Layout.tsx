import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useCartStore } from "../store/cartStore";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import CartPanel from "./CartPanel";

const GoogleIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

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
  const { user, isAdmin, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate("/");
  };

  const handleGoogleSignIn = async () => {
    sessionStorage.setItem("auth_return_to", location.pathname);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const displayName = profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Account";

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

            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-muted font-medium">Hi, {displayName}</span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-text-muted hover:text-error border border-primary/20 hover:border-error/30 px-3 py-1.5 rounded-button transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 text-sm font-medium border border-primary/20 hover:border-primary/50 hover:bg-primary/5 px-3 py-1.5 rounded-button transition-colors text-text-muted hover:text-primary"
              >
                <GoogleIcon />
                Sign In
              </button>
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
            {user ? (
              <>
                <p className="py-2 text-sm text-text-muted">Signed in as {displayName}</p>
                <button onClick={handleSignOut} className="block py-2 text-error font-medium w-full text-left">
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); handleGoogleSignIn(); }}
                className="flex items-center gap-2 py-2 text-text-muted hover:text-primary font-medium w-full"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
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
