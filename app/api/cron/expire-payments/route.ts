import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily job: expire long-pending payments and cancel their bookings.
 * Call it from Vercel cron (or any scheduler) with a `CRON_SECRET` header.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_pending_payments");
  if (error) {
    console.error("expire_pending_payments failed", error.code, error.message);
    return NextResponse.json({ ok: false, error: "UNEXPECTED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
