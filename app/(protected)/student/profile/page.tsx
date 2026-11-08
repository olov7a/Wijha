import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

/** Kept for old links: the single private profile now lives at /profile. */
export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).profile.title };
}

export default async function StudentProfilePage() {
  await requireRole("student");
  redirect("/profile");
}
