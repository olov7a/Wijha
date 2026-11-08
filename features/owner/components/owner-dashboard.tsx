"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelBooking } from "@/app/actions/bookings";
import { requestContract } from "@/app/actions/contracts";
import { getContractDownloadUrl } from "@/app/actions/profile";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BedIcon, BellIcon, BuildingIcon, CheckIcon, ClockIcon, DownloadIcon, MapPinIcon, PieIcon, PlusIcon, ShieldIcon, WalletIcon } from "@/components/ui/icons";
import { GenderBadge } from "@/components/ui/status";
import { actionErrorMessage } from "@/lib/action-errors";
import { formatMessage } from "@/lib/i18n/dictionary";
import { getPageCopy } from "@/lib/i18n/pages";
import type { OwnerBookingView, OwnerDashboardData } from "@/features/owner/queries";
import { cn } from "@/lib/cn";

const money = new Intl.NumberFormat("en-US");

export function OwnerDashboard({ name, data }: { name: string; data: OwnerDashboardData }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "active">("all");

  const labels =
    locale === "ar"
      ? {
          occupancy: "نسبة الإشغال",
          revenue: "مبلغ مدفوع (مؤكد)",
          totalUnits: "إجمالي الوحدات",
          approved: "معتمدة",
          pending: "بانتظار الاعتماد",
          activeBookings: "حجوزات نشطة",
          bookings: "حجوزات على وحداتي",
          emptyBookings: "لا توجد حجوزات مرتبطة بوحداتك بعد.",
          emptyUnits: "أضف أول وحدة لتظهر هنا.",
          addUnit: "أضف وحدة جديدة",
          student: "الطالب",
          room: "الغرفة",
          moveIn: "الاستلام",
          total: "إجمالي أول دفعة",
          payment: "الدفع",
          contract: "العقد",
          cancel: "إلغاء",
          requestContract: "طلب العقد",
          download: "تحميل العقد",
          requesting: "بيتم طلب العقد...",
          cancelling: "بيتم الإلغاء...",
          cancelDone: "تم إلغاء الحجز.",
          contractDone: "تم إرسال طلب العقد للأدمن.",
          downloadError: "ملف العقد لسه مش جاهز.",
          status: { pending_payment: "بانتظار الدفع", confirmed: "مؤكد", cancelled: "ملغي", completed: "مكتمل" },
          paymentStatus: { pending: "بانتظار التحصيل", paid: "مدفوع", failed: "فشل", refunded: "مسترد" },
          contractStatus: { not_requested: "لم يُطلب", requested: "بانتظار التوقيع", signed: "موقّع" },
          all: "كل الوحدات",
          activeOnly: "النشطة",
          beds: "أسرة",
          perBed: "ج.م / سرير / شهر",
          view: "عرض",
          contact: "موبايل",
        }
      : {
          occupancy: "Occupancy",
          revenue: "Paid (confirmed)",
          totalUnits: "Total units",
          approved: "Approved",
          pending: "Awaiting approval",
          activeBookings: "Active bookings",
          bookings: "Bookings on my units",
          emptyBookings: "No bookings are linked to your units yet.",
          emptyUnits: "Add your first unit to see it here.",
          addUnit: "Add a new unit",
          student: "Student",
          room: "Room",
          moveIn: "Move-in",
          total: "First payment total",
          payment: "Payment",
          contract: "Contract",
          cancel: "Cancel",
          requestContract: "Request contract",
          download: "Download contract",
          requesting: "Requesting...",
          cancelling: "Cancelling...",
          cancelDone: "Booking cancelled.",
          contractDone: "Contract request sent to the admin.",
          downloadError: "Contract file is not ready yet.",
          status: { pending_payment: "Awaiting payment", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed" },
          paymentStatus: { pending: "Awaiting collection", paid: "Paid", failed: "Failed", refunded: "Refunded" },
          contractStatus: { not_requested: "Not requested", requested: "Awaiting signature", signed: "Signed" },
          all: "All units",
          activeOnly: "Active",
          beds: "beds",
          perBed: "EGP / bed / month",
          view: "View",
          contact: "Phone",
        };

  const { stats } = data;
  const paidEg = money.format(Math.round(stats.paidPiastres / 100));
  const visibleUnits = tab === "active" ? data.units.filter((u) => u.status === "approved") : data.units;

  const cards = [
    { label: labels.occupancy, value: `${stats.occupancyPercent}%`, hint: `${stats.availableBeds} / ${stats.totalBeds} ${labels.beds}`, icon: PieIcon, tone: "bg-mint/35 text-teal-dark" },
    { label: labels.revenue, value: paidEg, hint: "EGP", icon: WalletIcon, tone: "bg-teal/10 text-teal" },
    { label: labels.totalUnits, value: String(stats.unitCount), hint: `${stats.approvedCount} ${labels.approved} • ${stats.pendingCount} ${labels.pending}`, icon: BuildingIcon, tone: "bg-brown/10 text-brown-ink" },
    { label: labels.activeBookings, value: String(stats.activeBookings), hint: `${stats.confirmedBookings} ${labels.status.confirmed}`, icon: BellIcon, tone: "bg-pending-soft text-pending-ink" },
  ];

  function run(id: string, task: () => Promise<void>) {
    setError(""); setNotice(""); setBusyId(id);
    startTransition(async () => { try { await task(); } finally { setBusyId(null); } });
  }

  async function cancel(b: OwnerBookingView) {
    if (!window.confirm(labels.cancel)) return;
    run(b.bookingId, async () => {
      const result = await cancelBooking({ bookingId: b.bookingId, reason: "owner cancelled from dashboard" });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.cancelDone); router.refresh();
    });
  }

  async function askForContract(b: OwnerBookingView) {
    run(b.bookingId, async () => {
      const result = await requestContract({ bookingId: b.bookingId });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.contractDone); router.refresh();
    });
  }

  async function download(b: OwnerBookingView) {
    if (!b.contractId) return;
    run(b.bookingId, async () => {
      const result = await getContractDownloadUrl({ contractId: b.contractId });
      if (!result.ok) { setError(labels.downloadError); return; }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="font-display text-2xl font-bold leading-relaxed sm:text-3xl">
            {formatMessage(copy.owner.greeting, { name })}
          </h1>
          <p className="mt-1.5 text-sm leading-7 text-slate">{copy.owner.description}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-mint/25 px-3 py-2 text-xs font-bold text-teal-dark">
            <ShieldIcon className="size-4" />
            {copy.owner.verified}
          </p>
        </div>
        <ButtonLink href="/owner/units/new" className="w-full sm:w-auto">
          <PlusIcon className="size-4" />
          {labels.addUnit}
        </ButtonLink>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate">{stat.label}</p>
                <span className={cn("grid size-8 place-items-center rounded-lg", stat.tone)}><Icon className="size-4" /></span>
              </div>
              <p className="mt-2 font-display text-xl font-bold">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-slate">{stat.hint}</p>
            </div>
          );
        })}
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">{error}</p>}
      {notice && <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink"><CheckIcon className="size-4" />{notice}</p>}

      <section className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            {labels.bookings}
            <span className="rounded-full bg-brown px-2 py-0.5 text-[11px] font-bold text-white">{data.bookings.length}</span>
          </h2>
        </div>
        {data.bookings.length === 0 ? (
          <div className="mt-3"><EmptyState title={labels.bookings} description={labels.emptyBookings} action={<ButtonLink href="/owner/units/new" size="sm">{labels.addUnit}</ButtonLink>} /></div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.bookings.map((b) => {
              const busy = pending && busyId === b.bookingId;
              return (
                <article key={b.bookingId} className="flex flex-col rounded-panel border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{b.studentName ?? labels.student}</p>
                      {b.studentPhone && <p className="mt-0.5 text-[11px] font-bold text-slate" dir="ltr">{labels.contact}: {b.studentPhone}</p>}
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", b.status === "confirmed" ? "bg-approved-soft text-approved-ink" : b.status === "cancelled" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                      {labels.status[b.status]}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-xl bg-canvas p-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{b.unitTitle}</span><span className="font-bold" dir="ltr">{b.unitArea}</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{labels.room}</span><span className="font-bold">{[b.roomName, b.bedLabel].filter(Boolean).join(" • ") || "—"}</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{labels.moveIn}</span><span className="font-bold" dir="ltr">{b.moveInDate}</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{labels.total}</span><span className="font-bold" dir="ltr">{money.format(Math.round(b.totalPiastres / 100))} EGP</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{labels.payment}</span><span className="font-bold">{b.paymentStatus ? labels.paymentStatus[b.paymentStatus] : "—"}</span></div>
                    <div className="flex items-center justify-between gap-2"><span className="text-slate">{labels.contract}</span><span className="font-bold">{labels.contractStatus[b.contractStatus]}</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.contractStatus === "signed" && b.contractId && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => download(b)} disabled={busy}><DownloadIcon className="size-4" />{labels.download}</Button>
                    )}
                    {b.status === "confirmed" && b.contractStatus === "not_requested" && (
                      <Button type="button" size="sm" onClick={() => askForContract(b)} disabled={busy}>{busy ? labels.requesting : labels.requestContract}</Button>
                    )}
                    {(b.status === "pending_payment" || b.status === "confirmed") && (
                      <Button type="button" size="sm" variant="danger" onClick={() => cancel(b)} disabled={busy}>{busy ? labels.cancelling : labels.cancel}</Button>
                    )}
                    {b.status === "confirmed" && b.contractStatus === "requested" && <p className="flex items-center gap-1.5 text-[11px] font-bold text-pending-ink"><ClockIcon className="size-4" />{labels.contractStatus.requested}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            {copy.owner.unitsTitle}
            <span className="text-xs font-normal text-slate">({data.units.length})</span>
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1 shadow-card">
            {(["all", "active"] as const).map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("rounded-md px-3 py-1 text-[11px] font-bold", tab === key ? "bg-canvas text-teal shadow-sm" : "text-slate")}>
                {key === "all" ? labels.all : labels.activeOnly}
              </button>
            ))}
          </div>
        </div>

        {visibleUnits.length === 0 ? (
          <div className="mt-3"><EmptyState title={copy.owner.unitsTitle} description={labels.emptyUnits} action={<ButtonLink href="/owner/units/new" size="sm">{labels.addUnit}</ButtonLink>} /></div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {visibleUnits.map((unit) => (
              <article key={unit.id} className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold leading-6">
                        <Link href={`/units/${unit.id}`} className="hover:text-teal">{unit.title}</Link>
                      </h3>
                      <p className="mt-1 flex items-start gap-1 text-[11px] leading-5 text-slate"><MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-teal" />{unit.area}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-display text-lg font-bold text-teal">{money.format(Math.round(unit.minPricePiastres / 100))}</p>
                      <p className="text-[10px] text-slate">{labels.perBed}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <GenderBadge gender={unit.gender} />
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", unit.status === "approved" ? "bg-approved-soft text-approved-ink" : unit.status === "rejected" ? "bg-rejected-soft text-rejected-ink" : "bg-pending-soft text-pending-ink")}>
                      {unit.status === "approved" ? copy.owner.activeBadge : unit.status === "rejected" ? copy.owner.full : labels.pending}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate"><BedIcon className="size-3.5" />{unit.availableBeds}/{unit.totalBeds} {labels.beds}</span>
                    <Link href={`/units/${unit.id}`} className="ms-auto min-h-9 rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-teal transition hover:border-teal hover:bg-teal/5">{labels.view}</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
