import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const supabaseUrl =
    process.env.NUTSNEWS_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing runtime public Supabase URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing runtime public Supabase anonymous key");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
