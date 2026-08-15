import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client configuration — database + storage only.
 *
 * Auth is handled by the lightweight named-identity provider in
 * AuthContext.tsx, not Supabase Auth (mirrors the CampaignOS seam where MSAL
 * owned auth and Supabase was data-only).
 *
 * Degrades to a placeholder client (with a console warning) instead of
 * throwing when the env vars are unset, so the rest of the Console still
 * boots and renders during setup — every consumer (use-email-templates.ts,
 * email-image-storage.ts) already has a localStorage/no-op fallback path for
 * when these calls fail.
 */
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase-client] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — " +
      "template storage and image uploads will no-op until they're configured in .env.local.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: "public",
    },
  },
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
