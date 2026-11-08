import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_PATH = "/dashboard";

/**
 * Only allow internal paths. `//evil.com` and `/\evil.com` are parsed by the
 * browser as absolute URLs, so they must be rejected too.
 */
function safeNextPath(value: string | null) {
  if (!value) return FALLBACK_PATH;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return FALLBACK_PATH;
  }
  return value;
}

export async function GET(request: NextRequest) {
  // Same-site origin check: a bare GET from another origin (e.g. a link in an
  // email from a foreign site) must not trigger a session exchange.
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (origin) {
    const allowed = process.env.NEXT_PUBLIC_SITE_URL;
    if (allowed) {
      try {
        if (new URL(origin).origin !== new URL(allowed).origin) {
          return NextResponse.redirect(new URL("/login?error=confirmation", request.url), { status: 302 });
        }
      } catch {
        return NextResponse.redirect(new URL("/login?error=confirmation", request.url), { status: 302 });
      }
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
