import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { requireSupabaseConfig } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

/**
 * Admin client. RLS is bypassed here on purpose because these operations must
 * cross user boundaries: leader approvals, student verification, payouts and
 * payment-gateway webhooks. Never import this module from a Client Component.
 */
export function createAdminClient() {
  const { url } = requireSupabaseConfig();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
