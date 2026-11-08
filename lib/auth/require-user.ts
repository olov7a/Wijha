import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

/** Page-level guard: protected routes redirect visitors without a session. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
