"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUserRole } from "@/app/actions/roles";
import { AdminUserSearch } from "@/features/admin/components/admin-user-search";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { BuildingIcon, CalendarIcon, ClockIcon, ShieldIcon, StarIcon, UserIcon, WalletIcon, CheckIcon } from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { AdminStats, AuditEntry, RecentUnit, RecentUser } from "@/features/admin/admin-data";
import { cn } from "@/lib/cn";

const money = new Intl.NumberFormat("en-US");

function formatDate(locale: string, iso: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

function RoleRow({ user, locale, labels }: { user: RecentUser; locale: string; labels: { role: string; changeRole: string; roleChanged: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function save() {
    setError(""); setNotice("");
    if (role === user.role) return;
    startTransition(async () => {
      const result = await setUserRole({ userId: user.id, role });
      if (!result.ok) { setError(actionErrorMessage(locale as "ar" | "en", result.error)); return; }
      setNotice(labels.roleChanged);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-canvas px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-bold">{user.fullName ?? user.id.slice(0, 8)}</span>
        <span className="shrink-0 text-[11px] font-bold text-slate">{labels.role}: {user.role}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} disabled={pending} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-bold" dir="ltr">
          <option value="student">student</option>
          <option value="owner">owner</option>
          <option value="team">team</option>
          <option value="leader">leader</option>
          <option value="admin">admin</option>
        </select>
        <Button type="button" size="sm" onClick={save} disabled={pending} variant="secondary">{labels.changeRole}</Button>
        {notice && <span className="flex items-center gap-1 text-[11px] font-bold text-approved-ink"><CheckIcon className="size-3.5" />{notice}</span>}
        {error && <span className="text-[11px] font-bold text-rejected-ink">{error}</span>}
      </div>
    </div>
  );
}

export function AdminDashboard({
  stats,
  recentUsers,
  recentUnits,
  audit,
}: {
  stats: AdminStats;
  recentUsers: RecentUser[];
  recentUnits: RecentUnit[];
  audit: AuditEntry[];
}) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);

  const labels =
    locale === "ar"
      ? {
          title: copy.admin.title,
          sub: copy.admin.subtitle,
          students: copy.admin.students,
          owners: copy.admin.owners,
          units: copy.admin.units,
          bookings: copy.admin.bookings,
          team: copy.admin.roleTeam,
          leader: copy.admin.roleLeader,
          paid: "مدفوعات مؤكدة",
          pendingPayments: "دفعات بانتظار التحصيل",
          pendingUnits: "وحدات بانتظار الاعتماد",
          contracts: "عقود بانتظار التوقيع",
          contractsSigned: "عقود موقّعة",
          pendingReviews: "تقييمات بانتظار المراجعة",
          pendingVerifications: "توثيقات هوية معلقة",
          beds: "أسرة متاحة",
          recentUsers: copy.admin.recentUsers,
          recentUnits: copy.admin.recentUnits,
          activity: copy.admin.activity,
          payments: copy.admin.payments,
          restore: copy.admin.restore,
          reviews: copy.admin.reviewModeration,
          viewAll: copy.admin.viewAll,
          role: copy.admin.role,
          joined: copy.admin.joined,
          status: copy.admin.status,
          actor: "بواسطة",
          system: "النظام",
          emptyActivity: "لا توجد أنشطة مسجلة بعد.",
          quick: copy.admin.quickActions,
          rolesTitle: "إدارة أدوار حسابات الاختبار",
          rolesHint: "رقّي أي حساب مسجل لدور فريق/قائد/أدمن لاختبار كل لوحة.",
          changeRole: "تغيير الدور",
          roleChanged: "تم تغيير الدور",
        }
      : {
          title: copy.admin.title,
          sub: copy.admin.subtitle,
          students: copy.admin.students,
          owners: copy.admin.owners,
          units: copy.admin.units,
          bookings: copy.admin.bookings,
          team: copy.admin.roleTeam,
          leader: copy.admin.roleLeader,
          paid: "Confirmed payments",
          pendingPayments: "Payments awaiting collection",
          pendingUnits: "Units awaiting approval",
          contracts: "Contracts awaiting signature",
          contractsSigned: "Signed contracts",
          pendingReviews: "Reviews awaiting moderation",
          pendingVerifications: "Pending identity verifications",
          beds: "Available beds",
          recentUsers: copy.admin.recentUsers,
          recentUnits: copy.admin.recentUnits,
          activity: copy.admin.activity,
          payments: copy.admin.payments,
          restore: copy.admin.restore,
          reviews: copy.admin.reviewModeration,
          viewAll: copy.admin.viewAll,
          role: copy.admin.role,
          joined: copy.admin.joined,
          status: copy.admin.status,
          actor: "By",
          system: "System",
          emptyActivity: "No activity recorded yet.",
          quick: copy.admin.quickActions,
          rolesTitle: "Test account roles",
          rolesHint: "Promote any registered account to team / leader / admin to test every dashboard.",
          changeRole: "Change role",
          roleChanged: "Role updated",
        };

  const cards = [
    { label: labels.students, value: stats.studentCount, hint: `${stats.teamCount} ${labels.team} • ${stats.leaderCount} ${labels.leader}`, icon: UserIcon, tone: "bg-teal/10 text-teal" },
    { label: labels.owners, value: stats.ownerCount, hint: labels.pendingVerifications, icon: ShieldIcon, tone: "bg-brown/10 text-brown-ink" },
    { label: labels.units, value: stats.unitCount, hint: `${stats.pendingUnits} ${labels.pendingUnits} • ${stats.approvedUnits} ${labels.status === "الحالة" ? "معتمدة" : "approved"}`, icon: BuildingIcon, tone: "bg-mint/35 text-teal-dark" },
    { label: labels.bookings, value: stats.bookingCount, hint: `${stats.confirmedBookings} confirmed • ${stats.activeBookings} active`, icon: CalendarIcon, tone: "bg-pending-soft text-pending-ink" },
    { label: labels.paid, value: money.format(Math.round(stats.paidPiastres / 100)), hint: "EGP", icon: WalletIcon, tone: "bg-approved-soft text-approved-ink" },
    { label: labels.pendingPayments, value: stats.pendingPayments, hint: "manual reconciliation", icon: ClockIcon, tone: "bg-pending-soft text-pending-ink" },
    { label: labels.contracts, value: stats.requestedContracts, hint: `${stats.signedContracts} signed`, icon: StarIcon, tone: "bg-brown/10 text-brown-ink" },
    { label: labels.beds, value: `${stats.availableBeds}/${stats.totalBeds}`, hint: stats.pendingReviews === 0 ? labels.pendingReviews : `${stats.pendingReviews} pending reviews`, icon: BuildingIcon, tone: "bg-teal/10 text-teal" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{labels.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{labels.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/payments" size="sm"><WalletIcon className="size-4" />{labels.payments}</ButtonLink>
          <ButtonLink href="/admin/reviews" size="sm" variant="secondary"><StarIcon className="size-4" />{labels.reviews}</ButtonLink>
          <ButtonLink href="/admin/restore" size="sm" variant="secondary"><ClockIcon className="size-4" />{labels.restore}</ButtonLink>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate">{c.label}</p>
                <span className={cn("grid size-8 place-items-center rounded-lg", c.tone)}><Icon className="size-4" /></span>
              </div>
              <p className="mt-2 font-display text-xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-[11px] text-slate">{c.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-panel border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">{labels.recentUsers}</h2>
          </div>
          {recentUsers.length === 0 ? (
            <p className="mt-3 text-sm text-slate">—</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentUsers.map((u) => (
                <RoleRow key={u.id} user={u} locale={locale} labels={labels} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-panel border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">{labels.recentUnits}</h2>
            <Link href="/leader" className="text-xs font-bold text-teal hover:underline">{labels.viewAll}</Link>
          </div>
          {recentUnits.length === 0 ? (
            <p className="mt-3 text-sm text-slate">—</p>
          ) : (
            <div className="mt-3 space-y-2">
              {recentUnits.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-bold">{u.title}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", u.status === "approved" ? "bg-approved-soft text-approved-ink" : u.status === "rejected" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                    {u.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AdminUserSearch />

      <section className="mt-7 rounded-panel border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-bold">{labels.rolesTitle}</h2>
        <p className="mt-1 text-xs text-slate">{labels.rolesHint}</p>
      </section>

      <section className="mt-7 rounded-panel border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-base font-bold">{labels.activity}</h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-slate">{labels.emptyActivity}</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {audit.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2 text-xs">
                <span className="font-bold" dir="ltr">{entry.action}</span>
                <span className="text-slate">{labels.actor} {entry.actorName ?? (entry.actorId ? entry.actorId.slice(0, 8) : labels.system)}</span>
                <span className="text-slate">{formatDate(locale, entry.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
