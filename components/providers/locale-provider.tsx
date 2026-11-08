"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  t: getDictionary(defaultLocale),
});

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: getDictionary(locale) }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
