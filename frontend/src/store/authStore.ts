import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,

  setUser: (user) => set({ user }),

  setProfile: (profile) =>
    set({ profile, isAdmin: profile?.role === "admin" }),

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      set({ profile: null, isAdmin: false });
      return;
    }

    set({
      profile: data as Profile,
      isAdmin: data?.role === "admin",
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAdmin: false });
  },

  initialize: async () => {
    set({ isLoading: true });

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      set({ user: session.user });
      await get().fetchProfile(session.user.id);
    }

    set({ isLoading: false });

    // Listen to auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        set({ user: null, profile: null, isAdmin: false });
      } else if (event === "USER_UPDATED" && session?.user) {
        set({ user: session.user });
        await get().fetchProfile(session.user.id);
      }
    });
  },
}));
