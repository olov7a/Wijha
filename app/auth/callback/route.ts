import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getRoleHomePath } from "@/lib/auth/role-redirect";
import { safeNextPath } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

// Auth callback: Supabase email links land here with `?code=...` and the
// session must be exchanged server-side. This route is intentionally public:
// it lives outside `app/(protected)`, and the root proxy only refreshes the
// session cookie (it never redirects unauthenticated users), so
// `/auth/callback` can never be blocked by route protection.
export const dynamic = "force-dynamic";

const ALREADY_CONFIRMED_ERROR = "already_confirmed";
const RESET_PASSWORD_PATH = "/reset-password";
const INVALID_RESET_LINK = "link_invalid";

function loginRedirect(request: NextRequest, error: string | null) {
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 302 });
}

/**
 * Recovery links that fail to exchange (expired, already used, or opened in a
 * different browser than the one that requested them) must send the user back
 * to the request screen, not to login with a confusing message.
 */
function failureRedirect(request: NextRequest, next: string | null) {
  if (next === RESET_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(`/forgot-password?error=${INVALID_RESET_LINK}`, request.url), {
      status: 302,
    });
  }
  return loginRedirect(request, ALREADY_CONFIRMED_ERROR);
}

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    return failureRedirect(request, next);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    // No code usually means the email was already confirmed (e.g. the link
    // was opened in another browser after a first successful exchange).
    return failureRedirect(request, next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return failureRedirect(request, next);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return failureRedirect(request, next);
  }

  // Recovery links carry `next=/reset-password`: the fresh session is exactly
  // what the reset form needs, so go straight there.
  if (next) {
    return NextResponse.redirect(new URL(next, request.url), { status: 302 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const target = getRoleHomePath(profile?.role);
  return NextResponse.redirect(new URL(target, request.url), { status: 302 });
}
