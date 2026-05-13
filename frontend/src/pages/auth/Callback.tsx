import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { Session } from "@supabase/supabase-js";

export default function AuthCallback() {
  const { setUser, fetchProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const next = localStorage.getItem("auth_redirect") || "/admin";
    localStorage.removeItem("auth_redirect");

    let done = false;

    async function proceed(session: Session) {
      if (done) return;
      done = true;
      setUser(session.user);
      await fetchProfile(session.user.id);
      navigate(next, { replace: true });
    }

    // Check immediately — PKCE exchange may already be complete
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) proceed(session);
    });

    // Listen in case exchange hasn't fired yet
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) proceed(session);
    });

    // Give up after 8s
    const timer = setTimeout(() => {
      if (!done) navigate("/admin/login", { replace: true });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="text-5xl block mb-4">🍞</span>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-text-muted text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
