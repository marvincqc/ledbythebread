import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import { withTimeout } from "../lib/withTimeout";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  setUser: (user: User | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<() => void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,

  setUser: (user) => set({ user }),

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", userId).single(),
        8000
      );
      if (error) {
        // Genuine DB error (no profile row) — not admin
        set({ profile: null, isAdmin: false });
        return;
      }
      set({ profile: data as Profile, isAdmin: data?.role === "admin" });
    } catch {
      // Network timeout or connection error — preserve existing auth state
      // A transient failure does not mean the user stopped being an admin
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000);
      if (session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      }
    } catch {
      // timeout — isLoading clears via finally, auth state stays as-is
    } finally {
      set({ isLoading: false });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        set({ user: null, profile: null, isAdmin: false });
      } else if (event === "USER_UPDATED" && session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  },
}));
