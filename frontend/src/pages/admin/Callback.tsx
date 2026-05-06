import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AdminCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "admin") {
        await supabase.auth.signOut();
        setError("This Google account does not have admin access.");
        return;
      }

      navigate("/admin", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <span className="text-5xl block mb-4">🍞</span>
        {error ? (
          <>
            <p className="text-error font-medium mb-2">{error}</p>
            <a href="/admin/login" className="text-primary text-sm underline">
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-text-muted text-sm">Verifying your account...</p>
          </>
        )}
      </div>
    </div>
  );
}
