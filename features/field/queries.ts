import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type VisitStatus = Database["public"]["Enums"]["visit_status"];
type UnitStatus = Database["public"]["Enums"]["unit_status"];
type Gender = Database["public"]["Enums"]["gender_type"];

const MISSING = new Set(["42P01", "PGRST202", "PGRST205"]);

export type VisitView = {
  id: string;
  unitId: string;
  unitTitle: string | null;
  unitArea: string | null;
  scheduledAt: string;
  status: VisitStatus;
  notes: string | null;
  hasEvaluation: boolean;
  evaluationScore: number | null;
};

export type TeamMemberView = { id: string; fullName: string | null };

export type LeaderUnitView = {
  id: string;
  title: string;
  area: string;
  gender: Gender;
  status: UnitStatus;
  ownerId: string;
  createdAt: string;
  visitCount: number;
  lastVisitAt: string | null;
  hasEvaluation: boolean;
  latestScore: number | null;
};

function missing(code: string | undefined | null) {
  return code && MISSING.has(code);
}

async function loadVisits(supabase: Awaited<ReturnType<typeof createClient>>, teamMemberId?: string) {
  let query = supabase
    .from("unit_visits")
    .select("id, unit_id, scheduled_at, status, notes")
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(200);
  if (teamMemberId) query = query.eq("team_member_id", teamMemberId);

  const { data, error } = await query;
  if (error) {
    if (!missing(error.code)) console.error("loadVisits failed", error);
    return [] as { id: string; unit_id: string; scheduled_at: string; status: VisitStatus; notes: string | null }[];
  }
  return data ?? [];
}

async function enrichVisits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visits: { id: string; unit_id: string; scheduled_at: string; status: VisitStatus; notes: string | null }[],
): Promise<VisitView[]> {
  if (!visits.length) return [];
  const unitIds = Array.from(new Set(visits.map((v) => v.unit_id)));
  const visitIds = visits.map((v) => v.id);
  const [{ data: units }, { data: evals }] = await Promise.all([
    supabase.from("units").select("id, title, area").in("id", unitIds),
    supabase.from("unit_evaluations").select("visit_id, score").in("visit_id", visitIds).is("deleted_at", null),
  ]);
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const evalByVisit = new Map((evals ?? []).map((e) => [e.visit_id, e.score]));
  return visits.map((v) => ({
    id: v.id,
    unitId: v.unit_id,
    unitTitle: unitById.get(v.unit_id)?.title ?? null,
    unitArea: unitById.get(v.unit_id)?.area ?? null,
    scheduledAt: v.scheduled_at,
    status: v.status,
    notes: v.notes,
    hasEvaluation: evalByVisit.has(v.id),
    evaluationScore: evalByVisit.get(v.id) ?? null,
  }));
}

export async function getTeamVisits(): Promise<VisitView[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const visits = await loadVisits(supabase, auth.user.id);
  return enrichVisits(supabase, visits);
}

export async function getLeaderData(): Promise<{ units: LeaderUnitView[]; teamMembers: TeamMemberView[]; visits: VisitView[] }> {
  if (!isSupabaseConfigured()) return { units: [], teamMembers: [], visits: [] };
  const supabase = await createClient();

  const [{ data: units, error: unitsError }, { data: team, error: teamError }] = await Promise.all([
    supabase.from("units").select("id, title, area, gender_type, status, owner_id, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, full_name").eq("role", "team").limit(200),
  ]);

  if (unitsError && !missing(unitsError.code)) console.error("getLeaderData units failed", unitsError);
  if (teamError && !missing(teamError.code)) console.error("getLeaderData team failed", teamError);

  const unitRows = units ?? [];
  const unitIds = unitRows.map((u) => u.id);

  let visitsEnriched: VisitView[] = [];
  const visitCount = new Map<string, number>();
  const lastVisit = new Map<string, string>();
  const evalScore = new Map<string, number>();

  if (unitIds.length) {
    const { data: visits } = await supabase.from("unit_visits").select("id, unit_id, scheduled_at, status, notes").in("unit_id", unitIds).is("deleted_at", null).order("scheduled_at", { ascending: false }).limit(200);
    const visitRows = visits ?? [];
    visitsEnriched = await enrichVisits(supabase, visitRows);
    for (const v of visitRows) {
      visitCount.set(v.unit_id, (visitCount.get(v.unit_id) ?? 0) + 1);
      const current = lastVisit.get(v.unit_id);
      if (!current || v.scheduled_at > current) lastVisit.set(v.unit_id, v.scheduled_at);
    }
    const { data: evals } = await supabase.from("unit_evaluations").select("unit_id, score, created_at").in("unit_id", unitIds).is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
    for (const e of evals ?? []) {
      if (!evalScore.has(e.unit_id)) evalScore.set(e.unit_id, e.score);
    }
  }

  return {
    units: unitRows.map((u) => ({
      id: u.id,
      title: u.title,
      area: u.area,
      gender: u.gender_type,
      status: u.status,
      ownerId: u.owner_id,
      createdAt: u.created_at,
      visitCount: visitCount.get(u.id) ?? 0,
      lastVisitAt: lastVisit.get(u.id) ?? null,
      hasEvaluation: evalScore.has(u.id),
      latestScore: evalScore.get(u.id) ?? null,
    })),
    teamMembers: (team ?? []).map((t) => ({ id: t.id, fullName: t.full_name })),
    visits: visitsEnriched,
  };
}
