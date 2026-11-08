import type { Metadata } from "next";
import { AddUnitForm } from "@/features/owner/components/add-unit-form";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).owner.newTitle };
}

export default async function NewOwnerUnitPage() {
  await requireRole("owner");

  return <AddUnitForm />;
}
