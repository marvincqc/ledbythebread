import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { withTimeout } from "../../lib/withTimeout";
import type { Session } from "@supabase/supabase-js";

export default function AuthCallback() {
  const { setUser, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("auth_redirect") || "/admin";
    localStorage.removeItem("auth_redirect");
    // Only allow relative paths — prevents open redirect via localStorage manipulation
    const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://") ? raw : "/admin";

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

      if (errorParam) {
        setErrorMsg(errorDesc ?? errorParam);
        setTimeout(() => navigate("/admin/login", { replace: true }), 3000);
        return;
      }

      if (code) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(window.location.href),
            10000
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
        } catch {
          // timeout — fall through to login
          navigate("/admin/login", { replace: true });
          return;
        }
      }

      // No code — check for existing session (page refresh)
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000);
        if (session) { await proceed(session); return; }
      } catch {
        // ignore
      }

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
