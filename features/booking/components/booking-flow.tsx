"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-field";
import { Stepper } from "@/components/ui/stepper";
import { CheckIcon, MapPinIcon, ShieldIcon } from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { localize, type SampleUnit } from "@/lib/sample-data";
import { actionErrorMessage } from "@/lib/action-errors";
import { createBooking } from "@/app/actions/bookings";
import { cn } from "@/lib/cn";
import type { BookingRoom } from "@/features/booking/types";

const numberFormatter = new Intl.NumberFormat("en-US");

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addMonths(dateString: string, months: number) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function BookingFlow({ unit, rooms }: { unit: SampleUnit; rooms: BookingRoom[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const [pending, startTransition] = useTransition();

  const availableRooms = rooms.filter((room) => room.beds.some((bed) => bed.status === "available"));
  const [roomId, setRoomId] = useState(() => availableRooms[0]?.id ?? "");
  const [bedId, setBedId] = useState(
    () => availableRooms[0]?.beds.find((bed) => bed.status === "available")?.id ?? "",
  );
  const [moveInDate, setMoveInDate] = useState("");
  const [months, setMonths] = useState(4);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);

  const selectedRoom = availableRooms.find((room) => room.id === roomId) ?? availableRooms[0];
  const selectedBed =
    selectedRoom?.beds.find((bed) => bed.id === bedId && bed.status === "available") ??
    selectedRoom?.beds.find((bed) => bed.status === "available");

  const rent = selectedBed?.price ?? unit.price;
  const moveOutDate = moveInDate ? addMonths(moveInDate, months) : null;
  const minDate = todayIso();
  const steps = [copy.booking.step1, copy.booking.step2, copy.booking.step3];

  const labels =
    locale === "ar"
      ? {
          room: "الغرفة",
          bed: "السرير",
          noBeds: "لا توجد أسرّة متاحة في الوحدة دلوقتي.",
          moveOut: "تاريخ الخروج المتوقع",
          reference: "رقم الحجز",
          awaiting:
            "السرير محجوز مؤقتًا وبانتظار تأكيد الدفع. هيظهر في لوحة حسابك فور التأكيد.",
          unavailable: "الحجز الإلكتروني للوحدة دي مش متاح لسه.",
          chooseDate: "اختار تاريخ الدخول الأول.",
        }
      : {
          room: "Room",
          bed: "Bed",
          noBeds: "No beds are available in this unit right now.",
          moveOut: "Expected move-out",
          reference: "Booking reference",
          awaiting: "The bed is held pending payment confirmation. It will appear in your dashboard once confirmed.",
          unavailable: "Online booking isn't available for this unit yet.",
          chooseDate: "Choose a move-in date first.",
        };

  function changeRoom(nextRoomId: string) {
    setRoomId(nextRoomId);
    const room = availableRooms.find((item) => item.id === nextRoomId);
    setBedId(room?.beds.find((bed) => bed.status === "available")?.id ?? "");
  }

  function goToSummary() {
    if (!selectedBed) {
      setError(labels.noBeds);
      return;
    }
    if (!moveInDate) {
      setError(labels.chooseDate);
      return;
    }
    setError("");
    setStep(2);
  }

  function submitBooking() {
    if (!selectedRoom || !selectedBed || !moveInDate || !moveOutDate) return;
    setError("");
    startTransition(async () => {
      const result = await createBooking({
        unitId: unit.id,
        roomId: selectedRoom.id,
        bedId: selectedBed.id,
        moveInDate,
        moveOutDate,
      });

      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }

      setBookingId(result.data.bookingId);
    });
  }

  if (bookingId) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-approved-soft text-approved">
          <CheckIcon className="size-8" />
        </span>
        <p className="mt-5 inline-flex rounded-full bg-approved-soft px-3 py-1 text-xs font-bold text-approved-ink">
          {copy.booking.successChip}
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold">{copy.booking.successTitle}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-slate">{labels.awaiting}</p>
        <p className="mt-3 inline-flex rounded-full bg-canvas px-3 py-1.5 text-xs font-bold text-slate" dir="ltr">
          {labels.reference}: {bookingId}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/student">{copy.booking.successDashboard}</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            {copy.booking.successHome}
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (availableRooms.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-canvas text-slate">
          <ShieldIcon className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold">{labels.unavailable}</h2>
        <p className="mt-2 text-sm text-slate">{labels.noBeds}</p>
        <ButtonLink href="/explore" variant="secondary" className="mt-6">
          {copy.nav.explore}
        </ButtonLink>
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">
      <div>
        <Stepper steps={steps} current={step} className="rounded-panel border border-line bg-surface p-5 shadow-card" />

        {step === 1 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              goToSummary();
            }}
            className="mt-6 space-y-5 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6"
          >
            <div>
              <h2 className="font-display text-xl font-bold">{copy.booking.studentTitle}</h2>
              <p className="mt-1 text-sm text-slate">{copy.booking.studentHint}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="room"
                label={labels.room}
                value={selectedRoom?.id ?? ""}
                onChange={(event) => changeRoom(event.target.value)}
              >
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>

              <Select
                name="bed"
                label={labels.bed}
                value={selectedBed?.id ?? ""}
                onChange={(event) => setBedId(event.target.value)}
              >
                {(selectedRoom?.beds ?? [])
                  .filter((bed) => bed.status === "available")
                  .map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.label} — {numberFormatter.format(bed.price)}
                    </option>
                  ))}
              </Select>

              <Input
                name="moveInDate"
                type="date"
                label={copy.unit.startDate}
                min={minDate}
                value={moveInDate}
                onChange={(event) => setMoveInDate(event.target.value)}
                required
              />

              <Select
                name="months"
                label={copy.unit.duration}
                value={String(months)}
                onChange={(event) => setMonths(Number(event.target.value))}
              >
                <option value="1">{copy.unit.durationTrial}</option>
                <option value="4">{copy.unit.durationTerm}</option>
                <option value="9">{copy.unit.durationYear}</option>
              </Select>
            </div>

            {moveOutDate && (
              <p className="rounded-xl bg-canvas px-4 py-3 text-xs font-bold text-slate">
                {labels.moveOut}: <span dir="ltr">{moveOutDate}</span>
              </p>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!selectedBed || !moveInDate}>
              {copy.booking.continue}
            </Button>
          </form>
        )}

        {step === 2 && (
          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">{copy.booking.summaryTitle}</h2>
            <p className="mt-3 text-sm leading-8 text-slate">{copy.booking.summaryBody}</p>

            <div className="mt-5 space-y-2.5 rounded-2xl bg-canvas p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate">{copy.booking.rent}</span>
                <span className="font-bold">{numberFormatter.format(rent)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate">{labels.room} / {labels.bed}</span>
                <span className="font-bold">
                  {selectedRoom?.name} · {selectedBed?.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate">{copy.unit.duration}</span>
                <span className="font-bold" dir="ltr">
                  {moveInDate} → {moveOutDate}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-base">
                <span className="font-bold">{copy.booking.total}</span>
                <span className="font-display text-xl font-bold text-teal">{numberFormatter.format(rent)}</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-teal/20 bg-mint/20 p-4">
              <h3 className="flex items-center gap-2 font-display font-bold text-teal-dark">
                <ShieldIcon className="size-5" />
                {copy.booking.policyTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate">{copy.booking.policyBody}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                {copy.booking.back}
              </Button>
              <Button type="button" size="lg" className="flex-1" onClick={() => setStep(3)}>
                {copy.booking.continue}
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="mt-6 p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">{copy.booking.step3}</h2>
            <div className="mt-4 rounded-2xl border border-line p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal">
                  <MapPinIcon className="size-5" />
                </span>
                <div>
                  <p className="font-bold">{localize(unit.name, locale)}</p>
                  <p className="mt-0.5 text-xs text-slate">{localize(unit.area, locale)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                <div>
                  <p className="text-slate">{copy.booking.term}</p>
                  <p className="mt-1 font-bold" dir="ltr">
                    {moveInDate} → {moveOutDate}
                  </p>
                </div>
                <div>
                  <p className="text-slate">{copy.booking.total}</p>
                  <p className="mt-1 font-bold text-teal">{numberFormatter.format(rent)}</p>
                </div>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-canvas p-4 text-sm leading-7">
              <input type="checkbox" required className="mt-1.5 size-4 accent-teal" />
              <span>
                {locale === "ar"
                  ? "أوافق على قواعد السكن وسياسة الإلغاء وشارفت على مراجعة بيانات الحجز."
                  : "I agree to the house rules, cancellation policy and reviewed my booking details."}
              </span>
            </label>

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep(2)} disabled={pending}>
                {copy.booking.back}
              </Button>
              <Button type="button" size="lg" className="flex-1" onClick={submitBooking} disabled={pending}>
                {pending ? (locale === "ar" ? "جاري الحجز..." : "Reserving...") : copy.booking.pay}
              </Button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate">
              <ShieldIcon className="size-4 text-teal" />
              {copy.booking.secure}
            </p>
          </Card>
        )}
      </div>

      <aside className="rounded-panel border border-line bg-surface p-5 shadow-panel lg:sticky lg:top-24">
        <h2 className="font-display text-lg font-bold">{copy.booking.unit}</h2>
        <div
          className={cn(
            "relative mt-4 flex min-h-32 items-end overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-mint/60 via-mint/20 to-surface p-4",
          )}
        >
          <div className="absolute inset-0 blueprint opacity-10" />
          <div className="relative">
            <p className="text-sm font-bold">{localize(unit.name, locale)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate">
              <MapPinIcon className="size-3.5 text-teal" />
              {localize(unit.area, locale)}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">{copy.booking.rent}</span>
            <span className="font-bold">{numberFormatter.format(rent)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">{labels.bed}</span>
            <span className="font-bold">{selectedBed?.label ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-base">
            <span className="font-bold">{copy.booking.total}</span>
            <span className="font-display text-xl font-bold text-teal">{numberFormatter.format(rent)}</span>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-canvas p-3 text-[11px] leading-6 text-slate">
          <ShieldIcon className="mt-0.5 size-4 shrink-0 text-teal" />
          {copy.booking.policyBody}
        </p>
      </aside>
    </div>
  );
}
