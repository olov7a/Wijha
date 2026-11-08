import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type UnitStatus = Database["public"]["Enums"]["unit_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type ContractStatus = Database["public"]["Enums"]["contract_status"];
type Gender = Database["public"]["Enums"]["gender_type"];

const MISSING = new Set(["42P01", "PGRST202", "PGRST205"]);

export type OwnerUnitView = {
  id: string;
  title: string;
  area: string;
  gender: Gender;
  status: UnitStatus;
  rating: number;
  reviewCount: number;
  roomCount: number;
  availableBeds: number;
  totalBeds: number;
  minPricePiastres: number;
  createdAt: string;
};

export type OwnerBookingView = {
  bookingId: string;
  unitId: string;
  unitTitle: string;
  unitArea: string;
  roomName: string | null;
  bedLabel: string | null;
  studentName: string | null;
  studentPhone: string | null;
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

export type OwnerDashboardData = {
  units: OwnerUnitView[];
  bookings: OwnerBookingView[];
  stats: {
    unitCount: number;
    approvedCount: number;
    pendingCount: number;
    totalBeds: number;
    availableBeds: number;
    occupancyPercent: number;
    activeBookings: number;
    confirmedBookings: number;
    paidPiastres: number;
  };
};

/** Owner's own inventory + bookings for /owner. Admins see their own + stats via same RPCs. */
export async function getOwnerDashboard(): Promise<OwnerDashboardData | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data: units, error } = await supabase
    .from("units")
    .select("id, title, area, gender_type, status, created_at")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (!MISSING.has(error.code ?? "")) console.error("getOwnerDashboard units failed", error);
    return null;
  }

  const unitRows = units ?? [];
  const unitIds = unitRows.map((u) => u.id);

  let roomCountByUnit = new Map<string, number>();
  let beds: { room_id: string; price_piastres: number; status: string }[] = [];
  let roomToUnit = new Map<string, string>();
  const minPriceByUnit = new Map<string, number>();

  if (unitIds.length) {
    const { data: rooms } = await supabase.from("rooms").select("id, unit_id").in("unit_id", unitIds).is("deleted_at", null);
    const roomRows = rooms ?? [];
    roomToUnit = new Map(roomRows.map((r) => [r.id, r.unit_id]));
    roomCountByUnit = new Map<string, number>();
    for (const r of roomRows) roomCountByUnit.set(r.unit_id, (roomCountByUnit.get(r.unit_id) ?? 0) + 1);

    if (roomRows.length) {
      const roomIds = roomRows.map((r) => r.id);
      const { data: bedRows } = await supabase.from("beds").select("room_id, price_piastres, status").in("room_id", roomIds).is("deleted_at", null);
      beds = bedRows ?? [];
      for (const bed of beds) {
        const uid = roomToUnit.get(bed.room_id);
        if (!uid) continue;
        const cur = minPriceByUnit.get(uid);
        if (cur == null || bed.price_piastres < cur) minPriceByUnit.set(uid, bed.price_piastres);
      }
    }
  }

  const availByUnit = new Map<string, number>();
  const totalByUnit = new Map<string, number>();
  for (const bed of beds) {
    const uid = roomToUnit.get(bed.room_id);
    if (!uid) continue;
    totalByUnit.set(uid, (totalByUnit.get(uid) ?? 0) + 1);
    if (bed.status === "available") availByUnit.set(uid, (availByUnit.get(uid) ?? 0) + 1);
  }

  let reviewRows: { target_id: string; rating: number }[] = [];
  if (unitIds.length) {
    const result = await supabase.from("reviews").select("target_id, rating").eq("target_type", "unit").eq("moderation_status", "approved").is("deleted_at", null).in("target_id", unitIds).limit(500);
    if (!result.error) reviewRows = result.data ?? [];
  }
  const ratingByUnit = new Map<string, { sum: number; count: number }>();
  for (const r of reviewRows ?? []) {
    const e = ratingByUnit.get(r.target_id) ?? { sum: 0, count: 0 };
    e.sum += r.rating; e.count += 1;
    ratingByUnit.set(r.target_id, e);
  }

  const unitViews: OwnerUnitView[] = unitRows.map((u) => {
    const rating = ratingByUnit.get(u.id);
    return {
      id: u.id,
      title: u.title,
      area: u.area,
      gender: u.gender_type,
      status: u.status,
      rating: rating ? Math.round((rating.sum / rating.count) * 10) / 10 : 0,
      reviewCount: rating?.count ?? 0,
      roomCount: roomCountByUnit.get(u.id) ?? 0,
      availableBeds: availByUnit.get(u.id) ?? 0,
      totalBeds: totalByUnit.get(u.id) ?? 0,
      minPricePiastres: minPriceByUnit.get(u.id) ?? 0,
      createdAt: u.created_at,
    };
  });

  const { data: bookingRows, error: bookingError } = await supabase.rpc("owner_bookings", { p_limit: 200 });
  if (bookingError && !MISSING.has(bookingError.code ?? "")) {
    console.error("getOwnerDashboard owner_bookings failed", bookingError);
  }

  const bookings: OwnerBookingView[] = (bookingRows ?? []).map((row) => ({
    bookingId: row.booking_id,
    unitId: row.unit_id,
    unitTitle: row.unit_title,
    unitArea: row.unit_area,
    roomName: row.room_name,
    bedLabel: row.bed_label,
    studentName: row.student_name,
    studentPhone: row.student_phone,
    moveInDate: row.move_in_date,
    moveOutDate: row.move_out_date,
    rentPiastres: row.rent_piastres,
    totalPiastres: row.total_piastres,
    status: row.status,
    paymentStatus: row.payment_status,
    contractId: row.contract_id,
    contractStatus: row.contract_status,
    createdAt: row.created_at,
  }));

  const totalBeds = unitViews.reduce((s, u) => s + u.totalBeds, 0);
  const availableBeds = unitViews.reduce((s, u) => s + u.availableBeds, 0);
  const paidPiastres = bookings.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + b.totalPiastres, 0);

  return {
    units: unitViews,
    bookings,
    stats: {
      unitCount: unitViews.length,
      approvedCount: unitViews.filter((u) => u.status === "approved").length,
      pendingCount: unitViews.filter((u) => u.status === "pending").length,
      totalBeds,
      availableBeds,
      occupancyPercent: totalBeds ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0,
      activeBookings: bookings.filter((b) => b.status === "pending_payment" || b.status === "confirmed").length,
      confirmedBookings: bookings.filter((b) => b.status === "confirmed").length,
      paidPiastres,
    },
  };
}
