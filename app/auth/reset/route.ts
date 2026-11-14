import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Recovery callback. Supabase password-reset emails redirect here with
 * `?code=...`; the code is exchanged server-side for a short-lived session,
 * then the user lands on the form that calls `auth.updateUser`.
 *
 * Kept separate from `/auth/callback` so the email redirect target has no
 * query string and matches the Supabase redirect allow-list exactly.
 */
export const dynamic = "force-dynamic";

function invalidLink(request: NextRequest) {
  return NextResponse.redirect(new URL("/forgot-password?error=link_invalid", request.url), {
    status: 302,
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return invalidLink(request);

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return invalidLink(request);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return invalidLink(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return invalidLink(request);

  return NextResponse.redirect(new URL("/reset-password", request.url), { status: 302 });
}
