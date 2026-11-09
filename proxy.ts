import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Session refresh only — this proxy never redirects visitors, so public
 * routes like `/auth/callback` and `/auth/confirm` stay reachable without
 * a session. Role guards live in `lib/auth/*` (protected layouts).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
