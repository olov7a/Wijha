import type { Metadata } from "next";
import Link from "next/link";
import { StudentBookings } from "@/features/student/components/student-bookings";
import { getStudentBookings } from "@/features/student/queries";
import { ButtonLink } from "@/components/ui/button";
import { CalendarIcon, CheckIcon, UserIcon, WalletIcon } from "@/components/ui/icons";
import { requireRole } from "@/lib/auth";
import { formatMessage } from "@/lib/i18n/dictionary";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).nav.bookings };
}

export default async function StudentPage() {
  const user = await requireRole("student");
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);
  const name = user.fullName?.split(" ")[0] ?? copy.booking.studentName;
  const bookings = await getStudentBookings();

  const active = bookings.filter((b) => b.status === "pending_payment" || b.status === "confirmed").length;
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  const paidTotal = bookings
    .filter((b) => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + b.totalPiastres, 0);
  const paidEg = Math.round(paidTotal / 100).toLocaleString("en-US");

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-approved-soft px-3 py-1.5 text-xs font-bold text-approved-ink">
            <CheckIcon className="size-4" />
            {copy.student.badge}
          </p>
          <h1 className="mt-3 font-display text-2xl font-bold leading-relaxed sm:text-3xl">
            {formatMessage(copy.student.greeting, { name })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">{copy.student.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/explore" variant="secondary">
            {copy.student.explore}
          </ButtonLink>
          <Link
            href="/student/profile"
            aria-label={copy.nav.profile}
            className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-teal hover:text-teal"
          >
            <UserIcon className="size-5" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: copy.student.protected, value: paidEg, hint: "EGP", icon: WalletIcon, tone: "bg-mint/35 text-teal-dark" },
          { label: copy.student.activeRequests, value: String(active), hint: copy.student.pending, icon: CalendarIcon, tone: "bg-pending-soft text-pending-ink" },
          { label: copy.student.pastBookings, value: String(confirmed), hint: copy.student.completed, icon: CheckIcon, tone: "bg-approved-soft text-approved-ink" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div>
                <p className="text-xs text-slate">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {stat.value} <span className="text-xs font-normal text-slate">{stat.hint}</span>
                </p>
              </div>
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${stat.tone}`}>
                <Icon className="size-5" />
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-7">
        <StudentBookings bookings={bookings} name={name} />
      </div>
    </div>
  );
}
