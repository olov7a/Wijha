"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBooking } from "@/app/actions/bookings";
import { requestContract } from "@/app/actions/contracts";
import { getContractDownloadUrl } from "@/app/actions/profile";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BedIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  DocumentIcon,
  DownloadIcon,
  MapPinIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { StudentBookingView } from "@/features/student/queries";
import { cn } from "@/lib/cn";

type TabKey = "active" | "past" | "cancelled";

const money = new Intl.NumberFormat("en-US");

function tabFor(booking: StudentBookingView): TabKey {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "past";
  return "active";
}

export function StudentBookings({ bookings, name }: { bookings: StudentBookingView[]; name: string }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabKey>("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const labels =
    locale === "ar"
      ? {
          active: "الحجوزات النشطة",
          past: "الحجوزات المكتملة",
          cancelled: "الحجوزات الملغاة",
          empty: "مفيش حجوزات في القسم ده",
          emptyBody: "لما تحجز وحدة جديدة هتظهر هنا مع حالة الدفع والعقد.",
          browse: "ابحث عن سكن",
          room: "الغرفة",
          bed: "السرير",
          moveIn: "تاريخ الاستلام",
          moveOut: "تاريخ الخروج",
          rent: "الإيجار الشهري",
          total: "إجمالي أول دفعة",
          bookingStatus: "حالة الحجز",
          payment: "الدفع",
          contract: "العقد",
          cancel: "إلغاء الحجز",
          requestContract: "طلب العقد",
          download: "تحميل العقد",
          contractRequested: "العقد مطلوب وبانتظار توقيع الإدارة",
          cancelling: "بيتم الإلغاء...",
          requesting: "بيتم طلب العقد...",
          cancelConfirm: "متأكد إنك عايز تلغي الحجز؟",
          cancelDone: "تم إلغاء الحجز.",
          contractDone: "تم إرسال طلب العقد للأدمن.",
          downloadError: "ملف العقد لسه مش جاهز.",
          status: {
            pending_payment: "بانتظار الدفع",
            confirmed: "مؤكد",
            cancelled: "ملغي",
            completed: "مكتمل",
          },
          paymentStatus: {
            pending: "بانتظار التحصيل",
            paid: "مدفوع",
            failed: "فشل",
            refunded: "مسترد",
          },
          contractStatus: {
            not_requested: "لم يُطلب",
            requested: "بانتظار التوقيع",
            signed: "موقّع وجاهز",
          },
          statActive: "حجوزات نشطة",
          statConfirmed: "عقود مؤكدة",
          statPaid: "مدفوعات مكتملة",
        }
      : {
          active: "Active bookings",
          past: "Completed stays",
          cancelled: "Cancelled bookings",
          empty: "No bookings in this section",
          emptyBody: "Once you book a unit it will appear here with its payment and contract state.",
          browse: "Find housing",
          room: "Room",
          bed: "Bed",
          moveIn: "Move-in date",
          moveOut: "Move-out date",
          rent: "Monthly rent",
          total: "First payment total",
          bookingStatus: "Booking status",
          payment: "Payment",
          contract: "Contract",
          cancel: "Cancel booking",
          requestContract: "Request contract",
          download: "Download contract",
          contractRequested: "Contract requested and waiting for an admin signature",
          cancelling: "Cancelling...",
          requesting: "Requesting...",
          cancelConfirm: "Cancel this booking?",
          cancelDone: "The booking was cancelled.",
          contractDone: "The contract request was sent to the admin.",
          downloadError: "The contract file is not ready yet.",
          status: {
            pending_payment: "Awaiting payment",
            confirmed: "Confirmed",
            cancelled: "Cancelled",
            completed: "Completed",
          },
          paymentStatus: {
            pending: "Awaiting collection",
            paid: "Paid",
            failed: "Failed",
            refunded: "Refunded",
          },
          contractStatus: {
            not_requested: "Not requested",
            requested: "Awaiting signature",
            signed: "Signed and ready",
          },
          statActive: "Active bookings",
          statConfirmed: "Confirmed contracts",
          statPaid: "Completed payments",
        };

  const activeCount = bookings.filter((booking) => tabFor(booking) === "active").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const paidCount = bookings.filter((booking) => booking.paymentStatus === "paid").length;
  const visible = bookings.filter((booking) => tabFor(booking) === tab);

  function run(bookingId: string, task: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusyId(bookingId);
    startTransition(async () => {
      try {
        await task();
      } finally {
        setBusyId(null);
      }
    });
  }

  function cancel(booking: StudentBookingView) {
    if (!window.confirm(labels.cancelConfirm)) return;
    run(booking.id, async () => {
      const result = await cancelBooking({ bookingId: booking.id, reason: "student cancelled from dashboard" });
      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }
      setNotice(labels.cancelDone);
      router.refresh();
    });
  }

  function askForContract(booking: StudentBookingView) {
    run(booking.id, async () => {
      const result = await requestContract({ bookingId: booking.id });
      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }
      setNotice(labels.contractDone);
      router.refresh();
    });
  }

  function download(booking: StudentBookingView) {
    if (!booking.contractId) return;
    run(booking.id, async () => {
      const result = await getContractDownloadUrl({ contractId: booking.contractId });
      if (!result.ok) {
        setError(labels.downloadError);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [CalendarIcon, labels.statActive, activeCount],
          [ShieldIcon, labels.statConfirmed, confirmedCount],
          [WalletIcon, labels.statPaid, paidCount],
        ].map(([Icon, label, value]) => {
          const StatIcon = Icon as typeof CalendarIcon;
          return (
            <Card key={String(label)} className="flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-xl bg-teal/10 text-teal">
                <StatIcon className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate">{String(label)}</p>
                <p className="font-display text-xl font-bold">{String(value)}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["active", labels.active],
            ["past", labels.past],
            ["cancelled", labels.cancelled],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-bold transition",
              tab === key ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal",
            )}
          >
            {label}
          </button>
        ))}
        <span className="ms-auto text-xs font-bold text-slate">
          {locale === "ar" ? `أهلًا ${name}` : `Hi ${name}`}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink">
          <CheckIcon className="size-4" />
          {notice}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={labels.empty}
          description={labels.emptyBody}
          action={<ButtonLink href="/explore" size="sm">{labels.browse}</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {visible.map((booking) => {
            const busy = pending && busyId === booking.id;
            return (
              <Card key={booking.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
                  <div>
                    <Link href={`/units/${booking.unitId}`} className="font-display text-lg font-bold hover:text-teal">
                      {booking.unitTitle}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate">
                      <MapPinIcon className="size-4" />
                      {booking.area}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
                      {labels.status[booking.status]}
                    </span>
                    {booking.paymentStatus && (
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold",
                          booking.paymentStatus === "paid"
                            ? "bg-approved-soft text-approved-ink"
                            : booking.paymentStatus === "failed"
                              ? "bg-rejected-soft text-rejected-ink"
                              : "bg-pending-soft text-pending-ink",
                        )}
                      >
                        {labels.payment}: {labels.paymentStatus[booking.paymentStatus]}
                      </span>
                    )}
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs font-bold text-slate">
                      {labels.contract}: {labels.contractStatus[booking.contractStatus]}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-bold text-slate">{labels.room}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                      <BedIcon className="size-4 text-teal" />
                      {[booking.roomName, booking.bedLabel].filter(Boolean).join(" • ") || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate">{labels.moveIn}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold" dir="ltr">
                      <CalendarIcon className="size-4 text-teal" />
                      {booking.moveInDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate">{labels.rent}</p>
                    <p className="mt-1 text-sm font-bold" dir="ltr">
                      {money.format(Math.round(booking.rentPiastres / 100))} EGP
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate">{labels.total}</p>
                    <p className="mt-1 text-sm font-bold" dir="ltr">
                      {money.format(Math.round(booking.totalPiastres / 100))} EGP
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/40 px-5 py-4">
                  {booking.contractStatus === "signed" && booking.contractId && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => download(booking)} disabled={busy}>
                      <DownloadIcon className="size-4" />
                      {labels.download}
                    </Button>
                  )}
                  {booking.status === "confirmed" && booking.contractStatus === "not_requested" && (
                    <Button type="button" size="sm" onClick={() => askForContract(booking)} disabled={busy}>
                      <DocumentIcon className="size-4" />
                      {busy ? labels.requesting : labels.requestContract}
                    </Button>
                  )}
                  {booking.status === "confirmed" && booking.contractStatus === "requested" && (
                    <p className="flex items-center gap-2 text-xs font-bold text-pending-ink">
                      <ClockIcon className="size-4" />
                      {labels.contractRequested}
                    </p>
                  )}
                  {(booking.status === "pending_payment" || booking.status === "confirmed") && (
                    <Button type="button" size="sm" variant="danger" onClick={() => cancel(booking)} disabled={busy} className="ms-auto">
                      {busy ? labels.cancelling : labels.cancel}
                    </Button>
                  )}
                  {booking.status === "completed" && (
                    <ButtonLink href={`/units/${booking.unitId}#reviews`} size="sm" variant="secondary">
                      {copy.student.rate}
                    </ButtonLink>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
