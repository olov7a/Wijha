import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUnitListings } from "@/features/units/queries";
import type { SampleUnit } from "@/lib/sample-data";
import type { Database } from "@/types/database.types";

const MISSING_FUNCTION = new Set(["42P01", "PGRST202", "PGRST205"]);
const MISSING_SCHEMA = new Set(["42P01", "PGRST205"]);

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type ContractStatus = Database["public"]["Enums"]["contract_status"];
type ModerationStatus = Database["public"]["Enums"]["moderation_status"];
type Gender = Database["public"]["Enums"]["gender_type"];

/**
 * Recommendations come from `match_units`, which applies the hard filters
 * (gender, approved unit, available bed) and weights the student's budget,
 * preferred areas, amenities and rating. When the RPC is unavailable — or the
 * student has not filled a profile yet — the public listings keep the screen
 * useful instead of showing an empty page.
 */
export async function getRecommendedUnits(): Promise<SampleUnit[]> {
  const listings = await getUnitListings();
  if (!isSupabaseConfigured()) return listings;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_units", { p_limit: 30 });

  if (error) {
    if (!MISSING_FUNCTION.has(error.code ?? "")) {
      console.error("getRecommendedUnits failed", error);
    }
    return listings;
  }

  if (!data || data.length === 0) return listings;

  const scores = new Map(data.map((row) => [row.unit_id, Math.round(Number(row.score) * 100)]));
  const byId = new Map(listings.map((unit) => [unit.id, unit]));

  return data
    .map((row) => byId.get(row.unit_id))
    .filter((unit): unit is SampleUnit => Boolean(unit))
    .map((unit) => ({ ...unit, matchScore: scores.get(unit.id) }));
}

export type StudentBookingView = {
  id: string;
  unitId: string;
  unitTitle: string;
  area: string;
  roomName: string | null;
  bedLabel: string | null;
  moveInDate: string;
  moveOutDate: string | null;
  rentPiastres: number;
  totalPiastres: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  contractId: string | null;
  contractStatus: ContractStatus;
  createdAt: string;
};

/** Every booking of the signed-in student with its payment and contract state. */
export async function getStudentBookings(): Promise<StudentBookingView[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return [];

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, unit_id, room_id, bed_id, move_in_date, move_out_date, rent_amount_piastres, total_amount_piastres, status, created_at",
    )
    .eq("student_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (!MISSING_SCHEMA.has(error.code ?? "")) console.error("getStudentBookings failed", error);
    return [];
  }

  const rows = bookings ?? [];
  if (rows.length === 0) return [];

  const bookingIds = rows.map((row) => row.id);
  const unitIds = Array.from(new Set(rows.map((row) => row.unit_id)));
  const roomIds = Array.from(new Set(rows.map((row) => row.room_id)));
  const bedIds = Array.from(new Set(rows.map((row) => row.bed_id).filter((id): id is string => Boolean(id))));

  const [paymentsResult, contractsResult, unitsResult, roomsResult, bedsResult] = await Promise.all([
    supabase
      .from("payments")
      .select("booking_id, status, created_at")
      .in("booking_id", bookingIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("id, booking_id, status")
      .in("booking_id", bookingIds)
      .is("deleted_at", null),
    supabase.from("units").select("id, title, area").in("id", unitIds),
    supabase.from("rooms").select("id, name").in("id", roomIds),
    bedIds.length
      ? supabase.from("beds").select("id, label").in("id", bedIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[], error: null }),
  ]);

  const paymentByBooking = new Map<string, PaymentStatus>();
  for (const payment of paymentsResult.data ?? []) {
    if (!paymentByBooking.has(payment.booking_id)) {
      paymentByBooking.set(payment.booking_id, payment.status);
    }
  }

  const contractByBooking = new Map(
    (contractsResult.data ?? []).map((contract) => [
      contract.booking_id,
      { id: contract.id, status: contract.status },
    ]),
  );
  const unitById = new Map((unitsResult.data ?? []).map((unit) => [unit.id, unit]));
  const roomById = new Map((roomsResult.data ?? []).map((room) => [room.id, room]));
  const bedById = new Map((bedsResult.data ?? []).map((bed) => [bed.id, bed]));

  return rows.map((booking) => {
    const unit = unitById.get(booking.unit_id);
    const contract = contractByBooking.get(booking.id);
    return {
      id: booking.id,
      unitId: booking.unit_id,
      unitTitle: unit?.title ?? "—",
      area: unit?.area ?? "—",
      roomName: roomById.get(booking.room_id)?.name ?? null,
      bedLabel: booking.bed_id ? bedById.get(booking.bed_id)?.label ?? null : null,
      moveInDate: booking.move_in_date,
      moveOutDate: booking.move_out_date,
      rentPiastres: booking.rent_amount_piastres,
      totalPiastres: booking.total_amount_piastres,
      status: booking.status,
      paymentStatus: paymentByBooking.get(booking.id) ?? null,
      contractId: contract?.id ?? null,
      contractStatus: contract?.status ?? "not_requested",
      createdAt: booking.created_at,
    };
  });
}

export type StudentProfileDetails = {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  gender: Gender | null;
  university: string | null;
  studyYear: number | null;
  isSmoker: boolean;
  hobbies: string[];
  budgetMinPiastres: number | null;
  budgetMaxPiastres: number | null;
  preferredAreas: string[];
  preferredAmenities: string[];
  verificationStatus: ModerationStatus | null;
  idDocumentPath: string | null;
  universityCardPath: string | null;
};

/** The signed-in student's personal row plus matching preferences. */
export async function getStudentProfile(): Promise<StudentProfileDetails | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [profileResult, studentResult] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("student_profiles").select("*").eq("user_id", user.id).is("deleted_at", null).maybeSingle(),
  ]);

  if (profileResult.error && !MISSING_SCHEMA.has(profileResult.error.code ?? "")) {
    console.error("getStudentProfile profile failed", profileResult.error);
  }
  if (studentResult.error && !MISSING_SCHEMA.has(studentResult.error.code ?? "")) {
    console.error("getStudentProfile student failed", studentResult.error);
  }

  const profile = profileResult.data;
  const student = studentResult.data;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    gender: student?.gender ?? null,
    university: student?.university ?? null,
    studyYear: student?.study_year ?? null,
    isSmoker: student?.is_smoker ?? false,
    hobbies: student?.hobbies ?? [],
    budgetMinPiastres: student?.budget_min_piastres ?? null,
    budgetMaxPiastres: student?.budget_max_piastres ?? null,
    preferredAreas: student?.preferred_areas ?? [],
    preferredAmenities: student?.preferred_amenities ?? [],
    verificationStatus: student?.verification_status ?? null,
    idDocumentPath: student?.id_document_path ?? null,
    universityCardPath: student?.university_card_path ?? null,
  };
}
