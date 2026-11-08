import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { requireSupabaseConfig } from "@/lib/env";

/**
 * Browser client: only the public anon/publishable key is used here.
 * Every query made with it is still constrained by RLS on the database.
 */
export function createClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
