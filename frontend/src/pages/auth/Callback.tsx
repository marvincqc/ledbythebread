import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { Session } from "@supabase/supabase-js";

export default function AuthCallback() {
  const { setUser, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");
      const errorDesc = params.get("error_description");

      // OAuth provider returned an error
      if (errorParam) {
        setErrorMsg(errorDesc ?? errorParam);
        setTimeout(() => navigate("/admin/login", { replace: true }), 3000);
        return;
      }

      // PKCE: exchange the code for a session explicitly
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error) {
          setErrorMsg(error.message);
          setTimeout(() => navigate("/admin/login", { replace: true }), 3000);
          return;
        }
        if (data.session) {
          await proceed(data.session);
          return;
        }
      }

      // No code — check if already has a session (e.g. page refresh)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await proceed(session);
        return;
      }

      // Nothing worked
      navigate("/admin/login", { replace: true });
    }

    handleCallback();
  }, []);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <span className="text-5xl block mb-4">🍞</span>
          <p className="text-error font-medium mb-2">Sign in failed</p>
          <p className="text-text-muted text-sm">{errorMsg}</p>
          <p className="text-text-muted text-xs mt-2">Redirecting back to login…</p>
        </div>
      </div>
    );
  }

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
