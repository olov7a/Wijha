"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import {
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  DocumentIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  StarIcon,
  UserIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import type { UserRole } from "@/types/database.types";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

function navForRole(role: UserRole, copy: ReturnType<typeof getPageCopy>): NavItem[] {
  const explore = { href: "/explore", label: copy.nav.explore, icon: SearchIcon };
  const profile = { href: "/profile", label: copy.nav.profile, icon: UserIcon };

  if (role === "student") {
    return [
      { href: "/student", label: copy.nav.dashboard, icon: HomeIcon },
      { href: "/student/recommendations", label: copy.nav.recommendations, icon: SparkIcon },
      explore,
      profile,
    ];
  }

  if (role === "owner") {
    return [
      { href: "/owner", label: copy.nav.dashboard, icon: HomeIcon },
      { href: "/owner/units/new", label: copy.nav.newUnit, icon: PlusIcon },
      explore,
      profile,
    ];
  }

  if (role === "team") {
    return [
      { href: "/team", label: copy.nav.tasks, icon: ShieldIcon },
      explore,
      profile,
    ];
  }

  if (role === "leader") {
    return [
      { href: "/leader", label: copy.nav.reviews, icon: CheckIcon },
      explore,
      profile,
    ];
  }

  return [
    { href: "/admin", label: copy.nav.admin, icon: ShieldIcon },
    { href: "/admin/payments", label: copy.admin.payments, icon: WalletIcon },
    { href: "/admin/restore", label: copy.admin.restore, icon: ClockIcon },
    { href: "/admin/reviews", label: copy.admin.reviewModeration, icon: StarIcon },
    { href: "/leader", label: copy.nav.reviews, icon: CheckIcon },
    { href: "/team", label: copy.nav.tasks, icon: ShieldIcon },
    { href: "/owner", label: copy.nav.units, icon: BuildingIcon },
    { href: "/student", label: copy.nav.bookings, icon: CalendarIcon },
    explore,
    profile,
  ];
}

function isActive(pathname: string, href: string) {
  if (href === "/owner" || href === "/student" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const items = navForRole(role, copy);

  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-60 shrink-0 border-e border-line bg-surface p-4 lg:block">
      <p className="px-3 pb-3 pt-2 text-xs font-bold text-slate">{copy.nav.dashboard}</p>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition",
                active ? "bg-teal/10 text-teal" : "text-slate hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-line bg-canvas p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-teal">
          <DocumentIcon className="size-4" />
          {copy.explore.guarantee}
        </p>
        <p className="mt-1.5 text-[11px] leading-5 text-slate">{copy.student.guaranteeBody}</p>
      </div>
    </aside>
  );
}

export function DashboardBottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const items = navForRole(role, copy).slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={`${item.href}-${item.label}`} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold",
                  active ? "text-teal" : "text-slate",
                )}
              >
                <span className={cn("grid size-9 place-items-center rounded-xl", active && "bg-teal/10")}>
                  <Icon className="size-5" />
                </span>
                <span className="line-clamp-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
