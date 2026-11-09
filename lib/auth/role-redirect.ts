import type { UserRole } from "@/types/database.types";

/**
 * Home dashboard per role. These are the EXISTING protected routes under
 * `app/(protected)` — the auth callback redirects here and never invents a
 * new destination. Unknown roles fall back to `/dashboard` (which itself
 * redirects to `/<role>` for signed-in users).
 */
export const ROLE_HOME_PATHS: Record<UserRole, string> = {
  student: "/student",
  owner: "/owner",
  team: "/team",
  leader: "/leader",
  admin: "/admin",
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "student" || value === "owner" || value === "team" || value === "leader" || value === "admin";
}

export function getRoleHomePath(role: string | null | undefined) {
  if (isUserRole(role)) return ROLE_HOME_PATHS[role];
  return "/dashboard";
}
