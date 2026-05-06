import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAdmin, isLoading, fetchProfile } = useAuthStore();
  const [settling, setSettling] = useState(true);

  // Handle OAuth redirect — Supabase puts the token in the URL hash.
  // Give the client a moment to exchange it before deciding to redirect.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setSettling(false);
    });
  }, [fetchProfile]);

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

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
