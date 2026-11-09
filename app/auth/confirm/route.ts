import { NextResponse, type NextRequest } from "next/server";

/**
 * Legacy alias for emails sent before the callback moved to
 * `/auth/callback`. Already-sent links keep working: forward the query
 * string untouched (`code`, `next`) and let the callback own the exchange
 * and the role-based redirect.
 *
 * The old same-origin check was removed on purpose: confirmation links
 * arrive cross-browser and cross-origin (email client -> Supabase ->
 * callback), so requiring a same-site `Origin`/`Referer` broke them.
 */
export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams);
  const query = searchParams.toString();
  const url = new URL(`/auth/callback${query ? `?${query}` : ""}`, request.url);
  return NextResponse.redirect(url, { status: 302 });
}
