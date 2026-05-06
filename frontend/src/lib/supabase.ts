import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

declare global {
  interface Window {
    __env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
  }
}

const supabaseUrl =
  window.__env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  window.__env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Helper: call an edge function with the current user's JWT
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const json = await response.json();

    if (!response.ok || !json.success) {
      return { data: null, error: json.error || "An error occurred" };
    }

    return { data: json as T, error: null };
  } catch (err) {
    return { data: null, error: String(err) };
  }
}
