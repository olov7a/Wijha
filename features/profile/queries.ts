import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Role = Database["public"]["Enums"]["app_role"];
type Moderation = Database["public"]["Enums"]["moderation_status"];
type Gender = Database["public"]["Enums"]["gender_type"];

const MISSING = new Set(["42P01", "PGRST202", "PGRST205"]);

export type MyProfile = {
  userId: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: Role;
  createdAt: string;
  student: {
    gender: Gender | null;
    university: string | null;
    studyYear: number | null;
    isSmoker: boolean;
    hobbies: string[];
    budgetMinPiastres: number | null;
    budgetMaxPiastres: number | null;
    preferredAreas: string[];
    preferredAmenities: string[];
    verificationStatus: Moderation | null;
    idDocumentPath: string | null;
    universityCardPath: string | null;
  } | null;
  owner: {
    idDocumentPath: string | null;
    ownershipProofPath: string | null;
    verificationStatus: Moderation | null;
  } | null;
};

/** Only ever returns the signed-in user's own row (auth.uid scoped). */
export async function getMyProfile(): Promise<MyProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, created_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !profile) {
    if (error && !MISSING.has(error.code ?? "")) console.error("getMyProfile failed", error);
    return null;
  }

  let student: MyProfile["student"] = null;
  let owner: MyProfile["owner"] = null;

  if (profile.role === "student") {
    const { data } = await supabase
      .from("student_profiles")
      .select("gender, university, study_year, is_smoker, hobbies, budget_min_piastres, budget_max_piastres, preferred_areas, preferred_amenities, verification_status, id_document_path, university_card_path")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    student = {
      gender: data?.gender ?? null,
      university: data?.university ?? null,
      studyYear: data?.study_year ?? null,
      isSmoker: data?.is_smoker ?? false,
      hobbies: data?.hobbies ?? [],
      budgetMinPiastres: data?.budget_min_piastres ?? null,
      budgetMaxPiastres: data?.budget_max_piastres ?? null,
      preferredAreas: data?.preferred_areas ?? [],
      preferredAmenities: data?.preferred_amenities ?? [],
      verificationStatus: data?.verification_status ?? null,
      idDocumentPath: data?.id_document_path ?? null,
      universityCardPath: data?.university_card_path ?? null,
    };
  } else if (profile.role === "owner") {
    const { data } = await supabase
      .from("owner_profiles")
      .select("id_document_path, ownership_proof_path, verification_status")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    owner = {
      idDocumentPath: data?.id_document_path ?? null,
      ownershipProofPath: data?.ownership_proof_path ?? null,
      verificationStatus: data?.verification_status ?? null,
    };
  }

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    createdAt: profile.created_at,
    student,
    owner,
  };
}
