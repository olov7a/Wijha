import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database.types";
import { requireUser } from "@/lib/auth/require-user";

/** Role-level guard: admins may open every dashboard as superusers. */
export async function requireRole(role: UserRole) {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (user.role !== role) redirect("/dashboard");
  return user;
}
