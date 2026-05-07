import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, fetchProfile, signOut } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);

  useEffect(() => {
    const intent = sessionStorage.getItem("auth_intent");
    sessionStorage.removeItem("auth_intent");

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      setUser(session.user);
      await fetchProfile(session.user.id);

      const { isAdmin } = useAuthStore.getState();

      if (isAdmin) {
        navigate("/admin", { replace: true });
        return;
      }

      // User tried to log in via admin login but doesn't have admin role
      if (intent === "admin") {
        setErrorEmail(session.user.email ?? null);
        await signOut();
        setError("This Google account does not have admin access.");
        return;
      }

      // Regular customer callback
      const returnTo = sessionStorage.getItem("auth_return_to") || "/";
      sessionStorage.removeItem("auth_return_to");
      navigate(returnTo, { replace: true });
    });
  }, [navigate, setUser, fetchProfile, signOut]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <span className="text-5xl block mb-4">🍞</span>
        {error ? (
          <div className="card p-6">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="font-semibold text-text-main mb-1">{error}</p>
            {errorEmail && (
              <p className="text-text-muted text-sm mb-4">
                Signed in as <span className="font-medium">{errorEmail}</span>
              </p>
            )}
            <a
              href="/admin/login"
              className="block w-full bg-primary text-white text-sm font-medium px-4 py-2.5 rounded-button hover:bg-primary-dark transition-all mb-2"
            >
              Try a different account
            </a>
            <a href="/" className="text-text-muted text-sm hover:text-primary transition-colors">
              Back to store
            </a>
          </div>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-muted text-sm">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
}
