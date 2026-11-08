"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/locale-provider";
import { getPageCopy } from "@/lib/i18n/pages";
import { CalendarIcon, HomeIcon, SearchIcon, SparkIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const icons = {
  home: HomeIcon,
  explore: SearchIcon,
  recommendations: SparkIcon,
  bookings: CalendarIcon,
  profile: UserIcon,
} as const;

type ItemKey = keyof typeof icons;

export function PublicBottomNav({ userRole }: { userRole?: string | null }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const copy = getPageCopy(locale);

  const items: Array<{ key: ItemKey; href: string; label: string }> = [
    { key: "home", href: "/", label: copy.nav.home },
    { key: "explore", href: "/explore", label: copy.nav.explore },
    { key: "recommendations", href: "/student/recommendations", label: copy.nav.recommendations },
    { key: "bookings", href: userRole ? "/student" : "/login", label: copy.nav.bookings },
    { key: "profile", href: userRole ? "/student/profile" : "/login", label: copy.nav.profile },
  ];

  return (
    <nav
      aria-label={copy.nav.home}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => {
          const Icon = icons[item.key];
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold transition-colors",
                  active ? "text-teal" : "text-slate hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-colors",
                    active && "bg-teal/10",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
