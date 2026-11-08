import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type UnitReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
};

export type ReviewGate =
  | { status: "anonymous" }
  | { status: "eligible" }
  | { status: "pending" | "approved" | "rejected" }
  | { status: "not_booked" };

function isMissingSchema(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * Sample units use slugs like `unit-1`, and Postgres rejects those when the
 * column is a uuid. Skipping the query keeps the sample pages renderable.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

/**
 * Approved reviews for a unit. Reviewer identities are deliberately not joined:
 * `profiles` is readable only by the owner and staff, so the public page shows a
 * "verified student" label instead of leaking a name.
 */
export async function getApprovedUnitReviews(unitId: string): Promise<UnitReview[]> {
  if (!isSupabaseConfigured() || !isUuid(unitId)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at")
    .eq("target_type", "unit")
    .eq("target_id", unitId)
    .eq("moderation_status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (!isMissingSchema(error)) console.error("getApprovedUnitReviews failed", error);
    return [];
  }

  return (data ?? []).map((review) => ({
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.created_at,
  }));
}

/**
 * Tells the unit page whether to show the review form. The database trigger
 * repeats the confirmed-booking check on insert, so this is only the UI layer.
 */
export async function getReviewGate(unitId: string): Promise<ReviewGate> {
  if (!isSupabaseConfigured() || !isUuid(unitId)) return { status: "anonymous" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { status: "anonymous" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "student") return { status: "not_booked" };

  const { data: existing, error: existingError } = await supabase
    .from("reviews")
    .select("moderation_status")
    .eq("reviewer_id", user.id)
    .eq("target_type", "unit")
    .eq("target_id", unitId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingError && !isMissingSchema(existingError)) {
    console.error("getReviewGate existing review failed", existingError);
  }

  if (existing) return { status: existing.moderation_status };

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("student_id", user.id)
    .eq("unit_id", unitId)
    .in("status", ["confirmed", "completed"])
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (bookingError && !isMissingSchema(bookingError)) {
    console.error("getReviewGate booking failed", bookingError);
  }

  return booking ? { status: "eligible" } : { status: "not_booked" };
}
