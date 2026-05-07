import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, fetchProfile } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      setUser(session.user);
      await fetchProfile(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        const returnTo = sessionStorage.getItem("auth_return_to") || "/";
        sessionStorage.removeItem("auth_return_to");
        navigate(returnTo, { replace: true });
      }
    });
  }, [navigate, setUser, fetchProfile]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="text-5xl block mb-4">🍞</span>
        {error ? (
          <>
            <p className="text-error font-medium mb-2">{error}</p>
            <a href="/" className="text-primary text-sm underline">Back to store</a>
          </>
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
