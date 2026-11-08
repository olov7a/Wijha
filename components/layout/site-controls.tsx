"use client";

import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { setLocale } from "@/app/actions/locale";
import { useI18n } from "@/components/providers/locale-provider";
import { GlobeIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

const themeColor = {
  light: "#f4fbf9",
  dark: "#07110f",
} as const;

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  try {
    localStorage.setItem("wijha-theme", theme);
  } catch {
    // Private mode can block storage; the class still updates for this page.
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor[theme]);
}

export function SiteControls({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as ViewTransitionDocument;

    if (!doc.startViewTransition || reducedMotion) {
      applyTheme(next);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-r", `${radius}px`);
    root.classList.add(next === "dark" ? "theme-to-dark" : "theme-to-light");

    const transition = doc.startViewTransition(() => applyTheme(next));
    transition.finished.finally(() => {
      root.classList.remove("theme-to-dark", "theme-to-light");
    });
  }

  function switchLanguage() {
    const next = locale === "ar" ? "en" : "ar";

    startTransition(async () => {
      await setLocale(next);
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      router.refresh();
    });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={t.common.toggleTheme}
        title={t.common.toggleTheme}
        className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface/80 text-ink shadow-sm backdrop-blur transition hover:border-teal hover:text-teal"
      >
        <MoonIcon className="size-5 dark:hidden" />
        <SunIcon className="hidden size-5 dark:block" />
      </button>

      <button
        type="button"
        onClick={switchLanguage}
        disabled={isPending}
        aria-label={t.common.switchLanguage}
        title={t.common.switchLanguage}
        aria-busy={isPending}
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 text-ink shadow-sm backdrop-blur transition hover:border-teal hover:text-teal disabled:opacity-60"
      >
        <GlobeIcon className="size-4" />
        <span className="text-xs font-bold" aria-hidden="true">
          {locale === "ar" ? "EN" : "ع"}
        </span>
      </button>
    </div>
  );
}
