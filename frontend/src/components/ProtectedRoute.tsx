import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, fetchProfile, setUser } = useAuthStore();
  const [settling, setSettling] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setSettling(false);
    });
  }, [fetchProfile, setUser]);

  if (isLoading || settling) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-4xl">🍞</span>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
