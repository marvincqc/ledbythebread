import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

export default function AuthCallback() {
  const { setUser, fetchProfile } = useAuthStore();

  useEffect(() => {
    const next = localStorage.getItem("auth_redirect") || "/";
    localStorage.removeItem("auth_redirect");

    let done = false;

    // Primary: onAuthStateChange fires reliably right after OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (done || !session) return;
      done = true;
      setUser(session.user);
      await fetchProfile(session.user.id);
      window.location.replace(next);
    });

    // Fallback: if onAuthStateChange doesn't fire within 5s
    const timer = setTimeout(async () => {
      if (done) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        done = true;
        setUser(session.user);
        await fetchProfile(session.user.id);
        window.location.replace(next);
      } else {
        window.location.replace("/admin/login");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [setUser, fetchProfile]);

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
