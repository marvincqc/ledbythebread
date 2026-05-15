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

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#FFF8F0;color:#8B5E3C;text-align:center;padding:24px">' +
    '<div><p style="font-size:48px;margin-bottom:16px">🍞</p>' +
    '<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Configuration missing</h2>' +
    '<p style="font-size:14px;opacity:.7">VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set as environment variables in Render.</p></div></div>';
  throw new Error("Missing Supabase environment variables.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Escape hatch for tables not yet in database.types.ts (e.g. after a migration before types are regenerated).
// Replace with typed supabase.from() once `npx supabase gen types` has been re-run.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const untypedSupabase = supabase as any;

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
