"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { confirmPayment, failPayment, refundPayment } from "@/app/actions/payments";
import { signContract } from "@/app/actions/contracts";
import { getContractDownloadUrl } from "@/app/actions/profile";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckIcon, DownloadIcon, DocumentIcon, ClockIcon, WalletIcon, XIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { AdminBookingView } from "@/features/admin/admin-data";
import { cn } from "@/lib/cn";

const money = new Intl.NumberFormat("en-US");

export function PaymentsPanel({ bookings }: { bookings: AdminBookingView[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "payments" | "contracts">("all");

  const labels =
    locale === "ar"
      ? {
          title: copy.admin.payments,
          sub: "تحصيل يدوي لحد ما نختار بوابة دفع. أكد الدفع بعد ما يستلم الفلوس + وقع العقد بإرفاق PDF.",
          all: "كل الحجوزات",
          payments: "تحصيل الدفع",
          contracts: "توقيع العقود",
          student: "الطالب",
          unit: "الوحدة",
          total: "الإجمالي",
          status: "حالة الحجز",
          payment: "الدفع",
          contract: "العقد",
          ref: "مرجع التحويل / الإيصال",
          refPlaceholder: "مثال: Fawry-123456",
          reason: "سبب الفشل",
          confirmPaid: "تأكيد الدفع",
          fail: "إفشال الدفع",
          uploadSign: "رفع PDF وتوقيع",
          uploading: "بيتم الرفع...",
          download: "تحميل العقد",
          donePaid: "تم تأكيد الدفع.",
          doneFail: "تم تسجيل فشل الدفع وإلغاء الحجز.",
          doneRefund: "تم تنفيذ الاسترداد.",
          refund: "استرداد (أدمن)",
          doneSign: "تم توقيع العقد وإرفاقه.",
          empty: "لا توجد حجوزات مرتبطة للمطابقة بعد.",
          statusMap: { pending_payment: "بانتظار الدفع", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل" },
          needContract: "اطلب الطالب/المالك للعقد أولاً.",
          needPayment: "لا توجد دفعة معلقة.",
        }
      : {
          title: copy.admin.payments,
          sub: "Manual reconciliation until a payment gateway is chosen. Confirm payment after collecting the money and sign the contract by attaching a PDF.",
          all: "All bookings",
          payments: "Payment collection",
          contracts: "Contract signing",
          student: "Student",
          unit: "Unit",
          total: "Total",
          status: "Booking status",
          payment: "Payment",
          contract: "Contract",
          ref: "Transfer / receipt reference",
          refPlaceholder: "e.g. Fawry-123456",
          reason: "Failure reason",
          confirmPaid: "Confirm payment",
          fail: "Fail payment",
          uploadSign: "Upload PDF & sign",
          uploading: "Uploading...",
          download: "Download contract",
          donePaid: "Payment confirmed.",
          doneFail: "Payment failure recorded and booking cancelled.",
          doneRefund: "Refund executed.",
          refund: "Refund (admin)",
          doneSign: "Contract signed and attached.",
          empty: "No bookings to reconcile yet.",
          statusMap: { pending_payment: "Pending payment", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed" },
          needContract: "Ask the student/owner to request the contract first.",
          needPayment: "No pending payment.",
        };

  const filtered =
    tab === "all"
      ? bookings
      : tab === "payments"
        ? bookings.filter((b) => b.paymentStatus === "pending")
        : bookings.filter((b) => b.contractStatus === "requested" || b.contractStatus === "signed");

  function run(id: string, task: () => Promise<void>) {
    setError(""); setNotice(""); setBusyId(id);
    startTransition(async () => { try { await task(); } finally { setBusyId(null); } });
  }

  async function confirmPaid(b: AdminBookingView) {
    const ref = (refs[b.id] ?? "").trim();
    if (ref.length < 3) { setError(locale === "ar" ? "اكتب مرجع التحويل (3 أحرف على الأقل)." : "Enter a transfer reference (min 3 chars)."); return; }
    run(b.id, async () => {
      const result = await confirmPayment({ bookingId: b.id, gatewayReference: ref });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.donePaid); router.refresh();
    });
  }

  async function failPaid(b: AdminBookingView) {
    const reason = (reasons[b.id] ?? "").trim() || (locale === "ar" ? "فشل الدفع" : "payment failed");
    run(b.id, async () => {
      const result = await failPayment({ bookingId: b.id, reason });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.doneFail); router.refresh();
    });
  }

  async function refundPaid(b: AdminBookingView) {
    if (!window.confirm(locale === "ar" ? "تنفيذ استرداد مبلغ مدفوع؟" : "Execute a refund of a paid amount?")) return;
    run(b.id, async () => {
      const result = await refundPayment({ bookingId: b.id });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.doneRefund); router.refresh();
    });
  }

  async function uploadSign(b: AdminBookingView, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !b.contractId) return;
    if (file.type !== "application/pdf") { setError(locale === "ar" ? "العقد لازم يكون PDF." : "Contract must be a PDF."); return; }
    setError(""); setNotice(""); setUploading(b.id);
    try {
      const supabase = createClient();
      const path = `${b.id}/contract-${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage.from("contracts").upload(path, file, { contentType: "application/pdf", upsert: true });
      if (uploadError) { setError(actionErrorMessage(locale, "UNEXPECTED")); return; }
      const result = await signContract({ contractId: b.contractId, filePath: path });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.doneSign); router.refresh();
    } finally {
      setUploading(null);
    }
  }

  async function download(b: AdminBookingView) {
    if (!b.contractId) return;
    run(b.id, async () => {
      const result = await getContractDownloadUrl({ contractId: b.contractId });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{labels.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{labels.sub}</p>
        </div>
        <div className="flex gap-2">
          {([
            ["all", labels.all],
            ["payments", labels.payments],
            ["contracts", labels.contracts],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={cn("rounded-full border px-4 py-2 text-sm font-bold transition", tab === key ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">{error}</p>}
      {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink"><CheckIcon className="size-4" />{notice}</p>}

      {filtered.length === 0 ? (
        <div className="mt-6"><EmptyState title={labels.title} description={labels.empty} /></div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((b) => {
            const busy = pending && busyId === b.id;
            const isPendingPay = b.paymentStatus === "pending" && b.status === "pending_payment";
            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
                  <div>
                    <p className="font-display text-base font-bold">{b.studentName ?? b.studentId.slice(0, 8)} • {b.unitTitle ?? b.unitId.slice(0, 8)}</p>
                    <p className="mt-1 text-xs text-slate" dir="ltr">{b.id} • {b.moveInDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs font-bold text-slate">{labels.status}: {labels.statusMap[b.status as keyof typeof labels.statusMap] ?? b.status}</span>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-bold", b.paymentStatus === "paid" ? "bg-approved-soft text-approved-ink" : b.paymentStatus === "failed" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                      {labels.payment}: {b.paymentStatus ?? "—"} • {money.format(Math.round((b.paymentAmount ?? b.totalPiastres) / 100))} EGP
                    </span>
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs font-bold text-slate">{labels.contract}: {b.contractStatus ?? "not_requested"}</span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-canvas/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold"><WalletIcon className="size-4" />{labels.payments}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate"><ClockIcon className="size-3.5" />{labels.total}: <span dir="ltr" className="font-bold text-ink">{money.format(Math.round(b.totalPiastres / 100))} EGP</span></p>
                    {isPendingPay ? (
                      <div className="mt-3 space-y-2">
                        <input value={refs[b.id] ?? ""} onChange={(e) => setRefs({ ...refs, [b.id]: e.target.value })} placeholder={labels.refPlaceholder} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" dir="ltr" />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={() => confirmPaid(b)} disabled={busy}><CheckIcon className="size-4" />{labels.confirmPaid}</Button>
                          <input value={reasons[b.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [b.id]: e.target.value })} placeholder={labels.reason} className="min-w-40 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
                          <Button type="button" size="sm" variant="danger" onClick={() => failPaid(b)} disabled={busy}><XIcon className="size-4" />{labels.fail}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate">{labels.needPayment}</p>
                    )}
                    {b.paymentStatus === "paid" && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => refundPaid(b)} disabled={busy} className="mt-3">
                        {labels.refund}
                      </Button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-line bg-canvas/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold"><DocumentIcon className="size-4" />{labels.contracts}</p>
                    {b.contractStatus === "requested" && b.contractId ? (
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover">
                        <DocumentIcon className="size-4" />
                        {uploading === b.id ? labels.uploading : labels.uploadSign}
                        <input type="file" accept="application/pdf" className="sr-only" disabled={uploading !== null} onChange={(e) => uploadSign(b, e)} />
                      </label>
                    ) : b.contractStatus === "signed" && b.contractId ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => download(b)} disabled={busy} className="mt-3"><DownloadIcon className="size-4" />{labels.download}</Button>
                    ) : (
                      <p className="mt-2 text-xs text-slate">{labels.needContract}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
