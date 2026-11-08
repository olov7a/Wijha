import { cache } from "react";
import type { UserRole } from "@/types/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  role: UserRole;
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * Resolve the signed-in user from verified Auth data, then load the role from
 * `profiles` (never from user-editable metadata). `cache` keeps one lookup per
 * request even when several Server Components ask for the user.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  return {
    id: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    email: data.user.email ?? null,
    phone: profile.phone ?? null,
  };
});
