export const locales = ["ar", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

/** Cookie that stores the visitor's language choice. */
export const localeCookie = "wijha-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "ar" || value === "en";
}

export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
