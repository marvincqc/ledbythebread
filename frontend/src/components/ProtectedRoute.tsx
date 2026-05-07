import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAuthStore();

  // isLoading is true only during the initial session check in App.tsx initialize()
  // After that it stays false — no re-check needed on every navigation
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-4xl">🍞</span>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login?error=access_denied" replace />;
  }

  return <>{children}</>;
}
