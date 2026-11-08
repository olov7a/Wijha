"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { submitUnitEvaluation, updateVisitStatus } from "@/app/actions/field";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BuildingIcon, CalendarIcon, CheckIcon, ClockIcon, MapPinIcon, ShieldIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { VisitView } from "@/features/field/queries";
import { cn } from "@/lib/cn";

const CHECK_KEYS = ["meters", "locks", "internet", "heaters"] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatDate(locale: string, iso: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function EvaluationDialog({ visit, onClose }: { visit: VisitView; onClose: () => void }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checks, setChecks] = useState<Record<string, boolean>>({ meters: false, locks: false, internet: false, heaters: false });
  const [score, setScore] = useState(80);
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const labels =
    locale === "ar"
      ? { title: "إرسال تقييم المعاينة", checklist: "فحص السلامة والجودة", score: "نتيجة الفحص (0-100)", photos: "صور المعاينة", upload: "إضافة صورة", saving: "بيتم الإرسال...", save: "حفظ التقييم وإغلاق الزيارة", cancel: "إلغاء", sent: "تم إرسال التقييم" }
      : { title: "Submit inspection evaluation", checklist: "Safety & quality checklist", score: "Inspection score (0-100)", photos: "Inspection photos", upload: "Add photo", saving: "Submitting...", save: "Save evaluation & close visit", cancel: "Cancel", sent: "Evaluation sent" };

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES || !ALLOWED_TYPES.includes(file.type)) {
      setError(locale === "ar" ? "الملف لازم يكون صورة أقل من 5 ميجابايت." : "The file must be an image under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${visit.unitId}/inspection-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("unit-photos").upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) { setError(actionErrorMessage(locale, "UNEXPECTED")); return; }
      setPhotoPaths((current) => [...current, path].slice(0, 10));
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError("");
    startTransition(async () => {
      const result = await submitUnitEvaluation({ visitId: visit.id, checklist: checks, score, photoPaths });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-strong/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-panel border border-line bg-surface p-5 shadow-panel">
        <h2 className="font-display text-base font-bold">{labels.title}</h2>
        <p className="mt-1 text-xs text-slate">{visit.unitTitle ?? visit.unitId} • {formatDate(locale, visit.scheduledAt)}</p>

        <div className="mt-4 space-y-2">
          <p className="text-sm font-bold">{labels.checklist}</p>
          {CHECK_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm font-bold">
              <input type="checkbox" checked={checks[key] ?? false} onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))} className="size-4 accent-teal" />
              {copy.team[key]}
            </label>
          ))}
        </div>

        <label className="mt-4 block text-sm font-bold">
          {labels.score}
          <input type="range" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} className="mt-2 w-full accent-teal" />
          <span className="text-xs text-slate" dir="ltr">{score} / 100</span>
        </label>

        <div className="mt-4">
          <p className="text-sm font-bold">{labels.photos} ({photoPaths.length}/10)</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brown px-4 py-2 text-xs font-bold text-brown-ink hover:bg-brown hover:text-white">
            {labels.upload}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading || photoPaths.length >= 10} onChange={upload} />
          </label>
          {photoPaths.length > 0 && <p className="mt-2 text-xs font-bold text-approved-ink">{photoPaths.length} ✓</p>}
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-rejected-soft px-3 py-2 text-xs font-bold text-rejected-ink">{error}</p>}

        <div className="mt-5 flex gap-2">
          <Button type="button" onClick={save} disabled={pending || uploading} className="flex-1">{pending ? labels.saving : labels.save}</Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>{labels.cancel}</Button>
        </div>
      </div>
    </div>
  );
}

export function TeamDashboard({ visits }: { visits: VisitView[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [evaluating, setEvaluating] = useState<VisitView | null>(null);
  const [error, setError] = useState("");

  const labels =
    locale === "ar"
      ? {
          title: copy.team.title,
          sub: "زيارات معاينة مسندة إليك. افتح الزيارة وسجّل التقييم ثم أغلقها.",
          empty: "لا توجد زيارات مسندة إليك بعد",
          emptyBody: "لما القائد يجدول زيارة باسمك هتظهر هنا فورًا.",
          evaluate: "بدء التقييم",
          evaluated: "تم التقييم",
          complete: "إغلاق الزيارة",
          cancelVisit: "إلغاء الزيارة",
          scheduled: "مجدولة",
          completed: "مكتملة",
          cancelled: "ملغاة",
          score: "النتيجة",
          notes: "ملاحظات القائد",
          done: "تم تحديث الزيارة",
        }
      : {
          title: copy.team.title,
          sub: "Inspection visits assigned to you. Open a visit, record the evaluation and close it.",
          empty: "No visits assigned to you yet",
          emptyBody: "Once a leader schedules a visit under your name it will appear here.",
          evaluate: "Start evaluation",
          evaluated: "Evaluated",
          complete: "Close visit",
          cancelVisit: "Cancel visit",
          scheduled: "Scheduled",
          completed: "Completed",
          cancelled: "Cancelled",
          score: "Score",
          notes: "Leader notes",
          done: "Visit updated",
        };

  const statusLabel = (s: VisitView["status"]) => (s === "completed" ? labels.completed : s === "cancelled" ? labels.cancelled : labels.scheduled);
  const open = visits.filter((v) => v.status === "scheduled").length;
  const done = visits.filter((v) => v.hasEvaluation).length;

  function changeStatus(visit: VisitView, status: "completed" | "cancelled") {
    setError("");
    startTransition(async () => {
      const result = await updateVisitStatus({ visitId: visit.id, status });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal"><ShieldIcon className="size-4" />{labels.title}</span>
          <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{labels.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{labels.sub}</p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-pending-soft px-3 py-1.5 text-pending-ink">{open} {labels.scheduled}</span>
          <span className="rounded-full bg-approved-soft px-3 py-1.5 text-approved-ink">{done} {labels.evaluated}</span>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">{error}</p>}

      {visits.length === 0 ? (
        <div className="mt-6"><EmptyState title={labels.empty} description={labels.emptyBody} /></div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visits.map((visit) => (
            <Card key={visit.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal"><BuildingIcon className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{visit.unitTitle ?? visit.unitId}</p>
                    {visit.unitArea && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate"><MapPinIcon className="size-3.5" />{visit.unitArea}</p>}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", visit.status === "completed" ? "bg-approved-soft text-approved-ink" : visit.status === "cancelled" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                  {statusLabel(visit.status)}
                </span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate"><CalendarIcon className="size-4" />{formatDate(locale, visit.scheduledAt)}</p>
              {visit.notes && <p className="mt-2 rounded-xl bg-canvas p-3 text-xs leading-6 text-slate"><span className="font-bold text-ink">{labels.notes}:</span> {visit.notes}</p>}
              {visit.hasEvaluation && visit.evaluationScore != null && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-approved-ink"><CheckIcon className="size-4" />{labels.score}: <span dir="ltr">{visit.evaluationScore}/100</span></p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {visit.status === "scheduled" && !visit.hasEvaluation && (
                  <>
                    <Button type="button" size="sm" onClick={() => setEvaluating(visit)} disabled={pending}><CheckIcon className="size-4" />{labels.evaluate}</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => changeStatus(visit, "completed")} disabled={pending}><ClockIcon className="size-4" />{labels.complete}</Button>
                  </>
                )}
                {visit.status === "scheduled" && (
                  <Button type="button" size="sm" variant="danger" onClick={() => changeStatus(visit, "cancelled")} disabled={pending}>{labels.cancelVisit}</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {evaluating && <EvaluationDialog visit={evaluating} onClose={() => setEvaluating(null)} />}
    </div>
  );
}
