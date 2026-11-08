import { cache } from "react";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookie, localeDirection, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";

/** Reads the language cookie once per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const value = store.get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
});

export async function getI18n(): Promise<{ locale: Locale; dir: "rtl" | "ltr"; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, dir: localeDirection(locale), t: getDictionary(locale) };
}
