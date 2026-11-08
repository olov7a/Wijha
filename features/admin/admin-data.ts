import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const MISSING = new Set(["42P01", "PGRST202", "PGRST205"]);

const COUNT_COL: Record<string, string> = {
  profiles: "id",
  units: "id",
  bookings: "id",
  payments: "id",
  contracts: "id",
  reviews: "id",
  student_profiles: "user_id",
};

const SOFT_DELETED = new Set(["units", "bookings", "payments", "contracts", "reviews", "student_profiles"]);

export type AdminStats = {
  studentCount: number;
  ownerCount: number;
  teamCount: number;
  leaderCount: number;
  unitCount: number;
  pendingUnits: number;
  approvedUnits: number;
  bookingCount: number;
  activeBookings: number;
  confirmedBookings: number;
  paidPiastres: number;
  pendingPayments: number;
  requestedContracts: number;
  signedContracts: number;
  pendingReviews: number;
  pendingVerifications: number;
  totalBeds: number;
  availableBeds: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const empty: AdminStats = {
    studentCount: 0, ownerCount: 0, teamCount: 0, leaderCount: 0,
    unitCount: 0, pendingUnits: 0, approvedUnits: 0,
    bookingCount: 0, activeBookings: 0, confirmedBookings: 0,
    paidPiastres: 0, pendingPayments: 0,
    requestedContracts: 0, signedContracts: 0,
    pendingReviews: 0, pendingVerifications: 0,
    totalBeds: 0, availableBeds: 0,
  };
  if (!isSupabaseConfigured()) return empty;
  const supabase = await createClient();

  async function count(table: "profiles" | "units" | "bookings" | "payments" | "contracts" | "reviews" | "student_profiles", filter?: Record<string, string>) {
    try {
      const column = COUNT_COL[table] ?? "id";
      let q = supabase.from(table).select(column, { count: "exact", head: true });
      if (filter) {
        for (const [key, value] of Object.entries(filter)) q = q.eq(key, value as never);
        if (SOFT_DELETED.has(table)) q = q.is("deleted_at", null);
      }
      const { count, error } = await q;
      if (error) {
        if (!MISSING.has(error.code ?? "")) console.error(`admin count ${table} failed`, error.code, error.message);
        return 0;
      }
      return count ?? 0;
    } catch {
      return 0;
    }
  }

  const [students, owners, team, leaders, units, pendingUnits, approvedUnits, bookings, confirmed, pendingPayments, requestedContracts, signedContracts, pendingReviews, pendingVerifications] = await Promise.all([
    count("profiles", { role: "student" }),
    count("profiles", { role: "owner" }),
    count("profiles", { role: "team" }),
    count("profiles", { role: "leader" }),
    count("units"),
    count("units", { status: "pending" }),
    count("units", { status: "approved" }),
    count("bookings"),
    count("bookings", { status: "confirmed" }),
    count("payments", { status: "pending" }),
    count("contracts", { status: "requested" }),
    count("contracts", { status: "signed" }),
    count("reviews", { moderation_status: "pending" }),
    count("student_profiles", { verification_status: "pending" }),
  ]);

  const pendingBookings = await count("bookings", { status: "pending_payment" });
  const { data: paidRows } = await supabase.from("payments").select("amount_piastres").eq("status", "paid").is("deleted_at", null).limit(500);
  const paidPiastres = (paidRows ?? []).reduce((s, r) => s + r.amount_piastres, 0);

  const { data: bedRows } = await supabase.from("beds").select("status").is("deleted_at", null).limit(2000);
  const totalBeds = (bedRows ?? []).length;
  const availableBeds = (bedRows ?? []).filter((b) => b.status === "available").length;

  return {
    studentCount: students, ownerCount: owners, teamCount: team, leaderCount: leaders,
    unitCount: units, pendingUnits, approvedUnits,
    bookingCount: bookings, activeBookings: confirmed + pendingBookings, confirmedBookings: confirmed,
    paidPiastres, pendingPayments,
    requestedContracts, signedContracts,
    pendingReviews, pendingVerifications,
    totalBeds, availableBeds,
  };
}

export type AdminBookingView = {
  id: string;
  studentId: string;
  studentName: string | null;
  unitId: string;
  unitTitle: string | null;
  moveInDate: string;
  totalPiastres: number;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  paymentAmount: number | null;
  contractId: string | null;
  contractStatus: string | null;
  contractFilePath: string | null;
  createdAt: string;
};

/** All bookings for the manual reconciliation screen. */
export async function getAdminBookings(): Promise<AdminBookingView[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, student_id, unit_id, move_in_date, total_amount_piastres, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (!MISSING.has(error.code ?? "")) console.error("getAdminBookings failed", error);
    return [];
  }
  const rows = bookings ?? [];
  if (!rows.length) return [];

  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const unitIds = Array.from(new Set(rows.map((r) => r.unit_id)));
  const bookingIds = rows.map((r) => r.id);

  const [profilesResult, unitsResult, paymentsResult, contractsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", studentIds),
    supabase.from("units").select("id, title").in("id", unitIds),
    supabase.from("payments").select("id, booking_id, status, amount_piastres, created_at").in("booking_id", bookingIds).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, booking_id, status, file_path").in("booking_id", bookingIds).is("deleted_at", null),
  ]);

  const names = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name]));
  const titles = new Map((unitsResult.data ?? []).map((u) => [u.id, u.title]));
  const paymentByBooking = new Map<string, { id: string; status: string; amount: number }>();
  for (const p of paymentsResult.data ?? []) {
    if (!paymentByBooking.has(p.booking_id)) paymentByBooking.set(p.booking_id, { id: p.id, status: p.status, amount: p.amount_piastres });
  }
  const contractByBooking = new Map((contractsResult.data ?? []).map((c) => [c.booking_id, c]));

  return rows.map((b) => {
    const pay = paymentByBooking.get(b.id);
    const contract = contractByBooking.get(b.id);
    return {
      id: b.id,
      studentId: b.student_id,
      studentName: names.get(b.student_id) ?? null,
      unitId: b.unit_id,
      unitTitle: titles.get(b.unit_id) ?? null,
      moveInDate: b.move_in_date,
      totalPiastres: b.total_amount_piastres,
      status: b.status,
      paymentId: pay?.id ?? null,
      paymentStatus: pay?.status ?? null,
      paymentAmount: pay?.amount ?? null,
      contractId: contract?.id ?? null,
      contractStatus: contract?.status ?? null,
      contractFilePath: contract?.file_path ?? null,
      createdAt: b.created_at,
    };
  });
}

export type RecentUser = { id: string; fullName: string | null; role: string; createdAt: string };
export type RecentUnit = { id: string; title: string; area: string; status: string; createdAt: string };
export type AuditEntry = { id: number; actorId: string | null; actorName: string | null; action: string; entityType: string; entityId: string | null; metadata: unknown; createdAt: string };

export async function getRecentUsers(): Promise<RecentUser[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(8);
  if (error) { if (!MISSING.has(error.code ?? "")) console.error("getRecentUsers failed", error); return []; }
  return (data ?? []).map((r) => ({ id: r.id, fullName: r.full_name, role: r.role, createdAt: r.created_at }));
}

export async function getRecentUnits(): Promise<RecentUnit[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("units").select("id, title, area, status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(8);
  if (error) { if (!MISSING.has(error.code ?? "")) console.error("getRecentUnits failed", error); return []; }
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, area: r.area, status: r.status, createdAt: r.created_at }));
}

export async function getAuditLogs(): Promise<AuditEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) { if (!MISSING.has(error.code ?? "")) console.error("getAuditLogs failed", error); return []; }
  const rows = data ?? [];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id))));
  let profiles: { id: string; full_name: string | null }[] = [];
  if (actorIds.length) {
    const result = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    if (!result.error) profiles = result.data ?? [];
  }
  const names = new Map<string, string | null>(profiles.map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({ id: r.id, actorId: r.actor_id, actorName: r.actor_id ? names.get(r.actor_id) ?? null : null, action: r.action, entityType: r.entity_type, entityId: r.entity_id, metadata: r.metadata, createdAt: r.created_at }));
}
