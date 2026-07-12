import { createClient } from "@supabase/supabase-js";
import { assertDataRead } from "@/lib/runtimeSafety";

type ServerSupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function getConfiguredServerSupabaseUrl() {
  return (
    process.env.NUTSNEWS_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NUTSNEWS_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function getServerSupabaseConfig(): ServerSupabaseConfig {
  assertDataRead("server-supabase-config");

  const url = getConfiguredServerSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Server-side Supabase access is not configured.");
  }

  return { url, serviceRoleKey };
}

export function getServerSupabase() {
  const { url, serviceRoleKey } = getServerSupabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabase() {
  assertDataRead("public-supabase-reader");

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
