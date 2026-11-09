import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getRoleHomePath } from "@/lib/auth/role-redirect";
import { createClient } from "@/lib/supabase/server";

// Auth callback: Supabase email links land here with `?code=...` and the
// session must be exchanged server-side. This route is intentionally public:
// it lives outside `app/(protected)`, and the root proxy only refreshes the
// session cookie (it never redirects unauthenticated users), so
// `/auth/callback` can never be blocked by route protection.
export const dynamic = "force-dynamic";

const ALREADY_CONFIRMED_ERROR = "already_confirmed";

function loginRedirect(request: NextRequest, error: string | null) {
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return loginRedirect(request, ALREADY_CONFIRMED_ERROR);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    // No code usually means the email was already confirmed (e.g. the link
    // was opened in another browser after a first successful exchange).
    return loginRedirect(request, ALREADY_CONFIRMED_ERROR);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(request, ALREADY_CONFIRMED_ERROR);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return loginRedirect(request, ALREADY_CONFIRMED_ERROR);
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const target = getRoleHomePath(profile?.role);
  return NextResponse.redirect(new URL(target, request.url), { status: 302 });
}
