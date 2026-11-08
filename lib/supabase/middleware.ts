import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { isSupabaseConfigured, requireSupabaseConfig } from "@/lib/env";

const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

/**
 * Refresh the Supabase session cookie on every request and keep authenticated
 * responses out of shared caches. `getUser()` verifies the token with Supabase
 * Auth instead of trusting the cookie.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);

  if (!isSupabaseConfigured()) return response;

  const { url, key } = requireSupabaseConfig();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
