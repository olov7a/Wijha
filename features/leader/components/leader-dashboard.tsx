"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { scheduleVisit } from "@/app/actions/field";
import { setUnitStatus } from "@/app/actions/units";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BuildingIcon, CalendarIcon, CheckIcon, MapPinIcon, PlusIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { GenderBadge } from "@/components/ui/status";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { LeaderUnitView, TeamMemberView, VisitView } from "@/features/field/queries";
import { cn } from "@/lib/cn";

type Filter = "all" | "pending" | "approved" | "rejected";

function formatDate(locale: string, iso: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium" }).format(new Date(iso));
}

function ScheduleDialog({ unit, teamMembers, onClose }: { unit: LeaderUnitView; teamMembers: TeamMemberView[]; onClose: () => void }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [memberId, setMemberId] = useState(teamMembers[0]?.id ?? "");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const labels =
    locale === "ar"
      ? { title: "جدولة زيارة معاينة", member: "عضو الفريق", time: "وقت الزيارة", notes: "ملاحظات (اختياري)", save: "جدولة الزيارة", cancel: "إلغاء", emptyTeam: "لا يوجد أعضاء فريق حاليًا. اطلب من الأدمن ترقية حساب إلى فريق أولاً." }
      : { title: "Schedule inspection visit", member: "Team member", time: "Visit time", notes: "Notes (optional)", save: "Schedule visit", cancel: "Cancel", emptyTeam: "No team members yet. Ask an admin to promote an account to team first." };

  if (teamMembers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-strong/40 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-panel border border-line bg-surface p-5">
          <p className="text-sm font-bold">{labels.emptyTeam}</p>
          <Button type="button" variant="secondary" onClick={onClose} className="mt-4">{labels.cancel}</Button>
        </div>
      </div>
    );
  }

  function save() {
    setError("");
    const date = new Date(when);
    if (!memberId || Number.isNaN(date.getTime())) {
      setError(locale === "ar" ? "اختار عضو الفريق ووقت الزيارة." : "Choose a team member and a visit time.");
      return;
    }
    startTransition(async () => {
      const result = await scheduleVisit({ unitId: unit.id, teamMemberId: memberId, scheduledAt: date.toISOString(), notes: notes || undefined });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-strong/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-panel border border-line bg-surface p-5 shadow-panel">
        <h2 className="font-display text-base font-bold">{labels.title}</h2>
        <p className="mt-1 text-xs text-slate">{unit.title}</p>

        <label className="mt-4 block text-sm font-bold">
          {labels.member}
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.fullName ?? m.id}</option>)}
          </select>
        </label>
        <label className="mt-4 block text-sm font-bold">
          {labels.time}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm" dir="ltr" />
        </label>
        <label className="mt-4 block text-sm font-bold">
          {labels.notes}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className="mt-2 w-full resize-none rounded-2xl border border-line bg-canvas px-3 py-3 text-sm" />
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl bg-rejected-soft px-3 py-2 text-xs font-bold text-rejected-ink">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button type="button" onClick={save} disabled={pending} className="flex-1">{pending ? "..." : labels.save}</Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>{labels.cancel}</Button>
        </div>
      </div>
    </div>
  );
}

export function LeaderDashboard({ units, teamMembers, visits }: { units: LeaderUnitView[]; teamMembers: TeamMemberView[]; visits: VisitView[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState("");
  const [scheduling, setScheduling] = useState<LeaderUnitView | null>(null);

  const labels =
    locale === "ar"
      ? {
          title: copy.leader.title,
          sub: copy.leader.subtitle,
          empty: "لا توجد وحدات في هذه الحالة",
          emptyBody: "الوحدات الجديدة من الملاك هتظهر هنا للاعتماد.",
          approve: "اعتماد",
          reject: "رفض",
          schedule: "جدولة زيارة",
          approved: "معتمدة",
          pending: "بانتظار الاعتماد",
          rejected: "مرفوضة",
          statusAll: "كل الحالات",
          visits: "زيارات مجدولة",
          visitsCount: "{count} زيارة",
          evaluated: "قيّمت",
          notEvaluated: "لسه بتتقيّم",
          score: "نتيجة آخر تقييم",
          done: "تم حفظ القرار",
          view: "عرض الوحدة",
        }
      : {
          title: copy.leader.title,
          sub: copy.leader.subtitle,
          empty: "No units in this state",
          emptyBody: "New owner units will appear here for approval.",
          approve: "Approve",
          reject: "Reject",
          schedule: "Schedule visit",
          approved: "Approved",
          pending: "Pending",
          rejected: "Rejected",
          statusAll: "All states",
          visits: "Scheduled visits",
          visitsCount: "{count} visits",
          evaluated: "Evaluated",
          notEvaluated: "Not evaluated yet",
          score: "Latest score",
          done: "Decision saved",
          view: "View unit",
        };

  const visible = units.filter((u) => filter === "all" || u.status === filter);
  const pendingCount = units.filter((u) => u.status === "pending").length;

  function decide(unitId: string, status: "approved" | "rejected" | "pending") {
    setError("");
    startTransition(async () => {
      const result = await setUnitStatus({ unitId, status });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      router.refresh();
    });
  }

  const statusLabel = (s: LeaderUnitView["status"]) => (s === "approved" ? labels.approved : s === "rejected" ? labels.rejected : labels.pending);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal"><ShieldIcon className="size-4" />{labels.title}</span>
          <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{labels.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{labels.sub}</p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-pending-soft px-3 py-1.5 text-pending-ink">{pendingCount} {labels.pending}</span>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-slate">{labels.visitsCount.replace("{count}", String(visits.filter((v) => v.status === "scheduled").length))}</span>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {([
          ["all", labels.statusAll],
          ["pending", labels.pending],
          ["approved", labels.approved],
          ["rejected", labels.rejected],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} className={cn("rounded-full border px-4 py-2 text-sm font-bold transition", filter === key ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal")}>
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-6"><EmptyState title={labels.empty} description={labels.emptyBody} /></div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {visible.map((unit) => (
            <Card key={unit.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><BuildingIcon className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{unit.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate"><MapPinIcon className="size-3.5" />{unit.area} • {formatDate(locale, unit.createdAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <GenderBadge gender={unit.gender} />
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", unit.status === "approved" ? "bg-approved-soft text-approved-ink" : unit.status === "rejected" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                    {statusLabel(unit.status)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate">
                <span className="flex items-center gap-1"><CalendarIcon className="size-3.5" />{labels.visitsCount.replace("{count}", String(unit.visitCount))}</span>
                {unit.latestScore != null ? (
                  <span className="text-approved-ink">{labels.score}: <span dir="ltr">{unit.latestScore}/100</span></span>
                ) : (
                  <span>{labels.notEvaluated}</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {unit.status !== "approved" && <Button type="button" size="sm" onClick={() => decide(unit.id, "approved")} disabled={pending}><CheckIcon className="size-4" />{labels.approve}</Button>}
                {unit.status !== "rejected" && <Button type="button" size="sm" variant="danger" onClick={() => decide(unit.id, "rejected")} disabled={pending}><XIcon className="size-4" />{labels.reject}</Button>}
                <Button type="button" size="sm" variant="secondary" onClick={() => setScheduling(unit)}><PlusIcon className="size-4" />{labels.schedule}</Button>
                <Link href={`/units/${unit.id}`} className="ms-auto inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold text-teal transition hover:border-teal hover:bg-teal/5">{labels.view}</Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <section className="mt-7">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><CalendarIcon className="size-5 text-teal" />{labels.visits}</h2>
        {visits.length === 0 ? (
          <p className="mt-2 text-sm text-slate">—</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {visits.slice(0, 8).map((v) => (
              <div key={v.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-bold">{v.unitTitle ?? v.unitId}</p>
                <p className="mt-1 text-[11px] text-slate">{formatDate(locale, v.scheduledAt)} • {v.status}{v.evaluationScore != null ? ` • ${labels.score} ${v.evaluationScore}/100` : ` • ${labels.notEvaluated}`}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {scheduling && <ScheduleDialog unit={scheduling} teamMembers={teamMembers} onClose={() => setScheduling(null)} />}
    </div>
  );
}
