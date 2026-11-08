"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, localeCookie, type Locale } from "@/lib/i18n/config";

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
