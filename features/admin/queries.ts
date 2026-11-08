import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { SoftDeleteEntity } from "@/features/soft-delete/schemas";

/**
 * One row in the admin restore screen. `title` comes from the deleted row,
 * `parentTitle` names the unit/room it belonged to, and `detail` carries the
 * small extra fact each entity has (rating, scheduled visit date).
 */
export type DeletedRecord = {
  entity: SoftDeleteEntity;
  id: string;
  title: string | null;
  parentTitle: string | null;
  detail: string | null;
  deletedAt: string;
};

const LIMIT = 100;

function byNewest(a: DeletedRecord, b: DeletedRecord) {
  return b.deletedAt.localeCompare(a.deletedAt);
}

/**
 * Soft-deleted rows visible to an admin. The `*_select_admin_all` RLS policies
 * are the only reason these rows can be read at all, so this query is safe to
 * keep client-role based; no service-role key is needed.
 */
export async function getDeletedRecords(): Promise<DeletedRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const [unitsResult, roomsResult, bedsResult, visitsResult, reviewsResult] = await Promise.all([
    supabase
      .from("units")
      .select("id, title, area, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("rooms")
      .select("id, name, unit_id, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("beds")
      .select("id, label, room_id, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("unit_visits")
      .select("id, unit_id, scheduled_at, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("reviews")
      .select("id, rating, target_type, target_id, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(LIMIT),
  ]);

  for (const [name, result] of [
    ["units", unitsResult],
    ["rooms", roomsResult],
    ["beds", bedsResult],
    ["unit_visits", visitsResult],
    ["reviews", reviewsResult],
  ] as const) {
    // A missing table means the migrations are not applied; an empty screen is
    // better than a crashed admin page.
    if (result.error && !["42P01", "PGRST205"].includes(result.error.code ?? "")) {
      console.error(`getDeletedRecords ${name} failed`, result.error);
    }
  }

  const units = unitsResult.data ?? [];
  const rooms = roomsResult.data ?? [];
  const beds = bedsResult.data ?? [];
  const visits = visitsResult.data ?? [];
  const reviews = reviewsResult.data ?? [];

  const unitIds = new Set<string>();
  rooms.forEach((room) => unitIds.add(room.unit_id));
  visits.forEach((visit) => unitIds.add(visit.unit_id));
  reviews.forEach((review) => {
    if (review.target_type === "unit") unitIds.add(review.target_id);
  });

  const roomIds = new Set(beds.map((bed) => bed.room_id));
  rooms.forEach((room) => roomIds.add(room.id));

  const [unitNames, roomNames] = await Promise.all([
    unitIds.size
      ? supabase
          .from("units")
          .select("id, title")
          .in("id", Array.from(unitIds))
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
    roomIds.size
      ? supabase
          .from("rooms")
          .select("id, name")
          .in("id", Array.from(roomIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  const unitTitles = new Map((unitNames.data ?? []).map((unit) => [unit.id, unit.title]));
  const roomLabels = new Map((roomNames.data ?? []).map((room) => [room.id, room.name]));

  const records: DeletedRecord[] = [
    ...units.map((unit) => ({
      entity: "unit" as const,
      id: unit.id,
      title: unit.title,
      parentTitle: unit.area,
      detail: null,
      deletedAt: unit.deleted_at as string,
    })),
    ...rooms.map((room) => ({
      entity: "room" as const,
      id: room.id,
      title: room.name,
      parentTitle: unitTitles.get(room.unit_id) ?? null,
      detail: null,
      deletedAt: room.deleted_at as string,
    })),
    ...beds.map((bed) => ({
      entity: "bed" as const,
      id: bed.id,
      title: bed.label,
      parentTitle: roomLabels.get(bed.room_id) ?? null,
      detail: null,
      deletedAt: bed.deleted_at as string,
    })),
    ...visits.map((visit) => ({
      entity: "unit_visit" as const,
      id: visit.id,
      title: null,
      parentTitle: unitTitles.get(visit.unit_id) ?? null,
      detail: visit.scheduled_at,
      deletedAt: visit.deleted_at as string,
    })),
    ...reviews.map((review) => ({
      entity: "review" as const,
      id: review.id,
      title: null,
      parentTitle:
        review.target_type === "unit" ? unitTitles.get(review.target_id) ?? null : null,
      detail: String(review.rating),
      deletedAt: review.deleted_at as string,
    })),
  ];

  return records.sort(byNewest);
}

export type PendingReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  unitId: string;
  unitTitle: string | null;
  authorName: string | null;
};

/** Reviews waiting for an admin decision. Staff RLS exposes them. */
export async function getPendingReviews(): Promise<PendingReview[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, rating, body, target_id, reviewer_id, created_at")
    .eq("target_type", "unit")
    .eq("moderation_status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(LIMIT);

  if (error) {
    if (!["42P01", "PGRST205"].includes(error.code ?? "")) {
      console.error("getPendingReviews failed", error);
    }
    return [];
  }

  const rows = reviews ?? [];
  if (rows.length === 0) return [];

  const unitIds = Array.from(new Set(rows.map((review) => review.target_id)));
  const authorIds = Array.from(new Set(rows.map((review) => review.reviewer_id)));

  const [unitsResult, authorsResult] = await Promise.all([
    supabase.from("units").select("id, title").in("id", unitIds),
    supabase.from("profiles").select("id, full_name").in("id", authorIds),
  ]);

  const unitTitles = new Map((unitsResult.data ?? []).map((unit) => [unit.id, unit.title]));
  const authorNames = new Map((authorsResult.data ?? []).map((profile) => [profile.id, profile.full_name]));

  return rows.map((review) => ({
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.created_at,
    unitId: review.target_id,
    unitTitle: unitTitles.get(review.target_id) ?? null,
    authorName: authorNames.get(review.reviewer_id) ?? null,
  }));
}
