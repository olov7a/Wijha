"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { amenities as amenityIcons } from "@/features/units/components/unit-amenity";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  BedIcon,
  BuildingIcon,
  CheckIcon,
  PlusIcon,
  ShieldIcon,
  SparkIcon,
  UploadIcon,
  XIcon,
} from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { actionErrorMessage } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/client";
import { createUnit } from "@/app/actions/units";
import { createUnitSchema } from "@/features/owner/schemas";
import { amenityLabels, localize, type AmenityKey } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

const numberFormatter = new Intl.NumberFormat("en-US");
const MAX_PHOTOS = 6;

const availableAmenities: AmenityKey[] = ["wifi", "ac", "laundry", "gas", "elevator", "desk", "security"];

type BedDraft = { id: string; label: string; price: number };
type RoomDraft = { id: string; name: string; beds: BedDraft[] };

function makeBed(index: number, price: number, prefix: string): BedDraft {
  return { id: `bed-${Date.now()}-${index}`, label: `${prefix} ${index + 1}`, price };
}

function initialRooms(prefix: string): RoomDraft[] {
  return [
    {
      id: "room-1",
      name: "",
      beds: [makeBed(0, 2800, prefix), makeBed(1, 2800, prefix)],
    },
  ];
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-bold">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[11px] leading-5 text-slate">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClassName =
  "min-h-12 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none transition placeholder:text-slate/70 focus:border-teal focus:bg-surface";

export function AddUnitForm() {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const [pending, startTransition] = useTransition();
  const bedPrefix = locale === "ar" ? "سرير" : "Bed";

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [description, setDescription] = useState("");
  const [rooms, setRooms] = useState<RoomDraft[]>(() => initialRooms(bedPrefix));
  const [selectedAmenities, setSelectedAmenities] = useState<AmenityKey[]>(["wifi", "ac", "desk"]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ unitId: string; photosFailed: number } | null>(null);

  const labels =
    locale === "ar"
      ? {
          title: "اسم الوحدة",
          titlePlaceholder: "مثال: شقة الدقي للطلاب",
          invalid: "راجع البيانات المدخلة الأول.",
          roomsTitle: "الغرف والأسرّة",
          roomsHint: "حدد كل غرفة والأسرّة اللي فيها وسعر كل سرير شهريًا.",
          roomName: "اسم الغرفة",
          roomNamePlaceholder: "مثال: غرفة 1",
          addRoom: "إضافة غرفة",
          removeRoom: "حذف الغرفة",
          bedLabel: "اسم السرير",
          bedPrice: "السعر الشهري",
          addBed: "إضافة سرير",
          removeBed: "حذف السرير",
          bedsTotal: "إجمالي الأسرّة",
          photosSelected: "صور مختارة",
          noPhoto: "تقدر تضيف الصور بعد إنشاء الوحدة، بس يُفضّل ترفعها الآن.",
          uploading: "جاري رفع الصور...",
          created: "تم إنشاء الوحدة",
          createdHint: "الوحدة بانتظار معاينة فريق وجهة قبل النشر. الصور اترفعت على حسابك.",
          photosWarning: "الوحدة اتعملت بس {count} صورة ما اترفعتش. تقدر ترفعها من لوحة التحكم.",
          addAnother: "إضافة وحدة أخرى",
          stepBasics: "البيانات الأساسية",
          stepRooms: "الغرف والأسعار",
          stepAmenities: "المرافق",
          stepPhotos: "الصور",
          requiredHint: "كل الأسرّة لازم يكون لها سعر أكبر من صفر.",
        }
      : {
          title: "Unit title",
          titlePlaceholder: "e.g. Dokki student flat",
          invalid: "Check the entered data first.",
          roomsTitle: "Rooms and beds",
          roomsHint: "List every room, its beds and the monthly price per bed.",
          roomName: "Room name",
          roomNamePlaceholder: "e.g. Room 1",
          addRoom: "Add room",
          removeRoom: "Remove room",
          bedLabel: "Bed label",
          bedPrice: "Monthly price",
          addBed: "Add bed",
          removeBed: "Remove bed",
          bedsTotal: "Total beds",
          photosSelected: "Selected photos",
          noPhoto: "You can add photos after creating the unit, but uploading them now is recommended.",
          uploading: "Uploading photos...",
          created: "Unit created",
          createdHint: "The unit is waiting for the WIJHA inspection before it is published. Your photos were uploaded.",
          photosWarning: "The unit was created, but {count} photo(s) failed to upload. You can retry from the dashboard.",
          addAnother: "Add another unit",
          stepBasics: "Basics",
          stepRooms: "Rooms and pricing",
          stepAmenities: "Amenities",
          stepPhotos: "Photos",
          requiredHint: "Every bed needs a price above zero.",
        };

  const totalBeds = rooms.reduce((total, room) => total + room.beds.length, 0);
  const minBedPrice = rooms
    .flatMap((room) => room.beds.map((bed) => bed.price))
    .filter((price) => price > 0)
    .reduce((min, price) => Math.min(min, price), Number.POSITIVE_INFINITY);

  const steps = [
    { id: "basics", number: 1, title: labels.stepBasics, hint: copy.owner.area },
    { id: "rooms", number: 2, title: labels.stepRooms, hint: copy.owner.monthlyPrice },
    { id: "amenities", number: 3, title: labels.stepAmenities, hint: copy.explore.amenities },
    { id: "photos", number: 4, title: labels.stepPhotos, hint: copy.owner.photos },
  ];

  function goToStep(next: number) {
    setStep(next);
    const target = steps[next - 1];
    document.getElementById(target.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAmenity(amenity: AmenityKey) {
    setSelectedAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity],
    );
  }

  function addRoom() {
    setRooms((current) => [
      ...current,
      { id: `room-${Date.now()}`, name: "", beds: [makeBed(0, 2800, bedPrefix)] },
    ]);
    setStep(2);
  }

  function removeRoom(roomId: string) {
    setRooms((current) => (current.length === 1 ? current : current.filter((room) => room.id !== roomId)));
  }

  function updateRoom(roomId: string, patch: Partial<Pick<RoomDraft, "name">>) {
    setRooms((current) => current.map((room) => (room.id === roomId ? { ...room, ...patch } : room)));
  }

  function addBed(roomId: string) {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? { ...room, beds: [...room.beds, makeBed(room.beds.length, room.beds[0]?.price ?? 2800, bedPrefix)] }
          : room,
      ),
    );
  }

  function removeBed(roomId: string, bedId: string) {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId && room.beds.length > 1
          ? { ...room, beds: room.beds.filter((bed) => bed.id !== bedId) }
          : room,
      ),
    );
  }

  function updateBed(roomId: string, bedId: string, patch: Partial<Pick<BedDraft, "label" | "price">>) {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? { ...room, beds: room.beds.map((bed) => (bed.id === bedId ? { ...bed, ...patch } : bed)) }
          : room,
      ),
    );
  }

  function selectPhotos(files: FileList | null) {
    if (!files) return;
    setPhotos(Array.from(files).slice(0, MAX_PHOTOS));
  }

  async function uploadPhotos(unitId: string) {
    if (photos.length === 0) return 0;

    let failed = 0;
    try {
      const supabase = createClient();
      for (const [index, file] of photos.entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
        const path = `${unitId}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("unit-photos")
          .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
        if (uploadError) failed += 1;
      }
    } catch {
      return photos.length;
    }

    return failed;
  }

  function submit() {
    setError("");

    const payload = {
      title: title.trim(),
      area: area.trim(),
      gender,
      amenities: selectedAmenities,
      rooms: rooms.map((room) => ({
        name: room.name.trim(),
        beds: room.beds.map((bed) => ({ label: bed.label.trim(), price: bed.price })),
      })),
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    const parsed = createUnitSchema.safeParse(payload);
    if (!parsed.success) {
      setError(labels.invalid);
      return;
    }

    startTransition(async () => {
      const result = await createUnit(parsed.data);
      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }

      const photosFailed = await uploadPhotos(result.data.unitId);
      setCreated({ unitId: result.data.unitId, photosFailed });
    });
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="rounded-panel border border-line bg-surface p-6 text-center shadow-card sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-approved-soft text-approved">
            <CheckIcon className="size-8" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">{labels.created}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-slate">{labels.createdHint}</p>
          <p className="mt-3 inline-flex rounded-full bg-canvas px-3 py-1.5 text-xs font-bold text-slate" dir="ltr">
            {created.unitId}
          </p>

          {created.photosFailed > 0 && (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800">
              {labels.photosWarning.replace("{count}", String(created.photosFailed))}
            </p>
          )}

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/owner">{copy.nav.dashboard}</ButtonLink>
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              {labels.addAnother}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1.5 text-[11px] font-bold text-teal">
            <ShieldIcon className="size-4" />
            {copy.owner.verified}
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold leading-relaxed sm:text-3xl">{copy.owner.newTitle}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{copy.owner.newSubtitle}</p>
        </div>
        <ButtonLink href="/owner" variant="secondary" className="w-full sm:w-auto">
          {copy.nav.dashboard}
        </ButtonLink>
      </div>

      <nav aria-label={copy.owner.newTitle} className="mt-5 grid grid-cols-2 gap-2 rounded-panel border border-line bg-surface p-3 shadow-card lg:grid-cols-4">
        {steps.map((item) => {
          const active = step === item.number;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(item.number)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2.5 text-start transition",
                active ? "bg-canvas shadow-sm" : "opacity-75 hover:opacity-100",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold",
                  active ? "bg-primary text-primary-foreground" : "bg-canvas text-slate",
                )}
              >
                {item.number}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-xs font-bold", active ? "text-teal" : "text-ink")}>{item.title}</span>
                <span className="block truncate text-[10px] text-slate">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section id="basics" className="scroll-mt-24 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <BuildingIcon className="size-5 text-teal" />
              {copy.owner.basic}
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={labels.title} htmlFor="title" className="sm:col-span-2">
                <input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={labels.titlePlaceholder}
                  maxLength={120}
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label={copy.owner.area} htmlFor="area">
                <input
                  id="area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder={locale === "ar" ? "مثال: الدقي، الجيزة" : "e.g. Dokki, Giza"}
                  maxLength={120}
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label={copy.owner.category}>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["female", copy.owner.femaleCategory],
                      ["male", copy.owner.maleCategory],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      aria-pressed={gender === value}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-xs font-bold transition",
                        gender === value ? "border-teal bg-teal/5 text-teal" : "border-line bg-surface text-slate hover:border-teal/40",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={copy.owner.unitDescription} htmlFor="description" className="sm:col-span-2">
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={copy.owner.descriptionPlaceholder}
                  maxLength={3000}
                  className={cn(inputClassName, "min-h-28 resize-none py-3")}
                />
              </Field>
            </div>
          </section>

          <section id="rooms" className="scroll-mt-24 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <BedIcon className="size-5 text-teal" />
                  {labels.roomsTitle}
                </h2>
                <p className="mt-1 text-xs leading-6 text-slate">{labels.roomsHint}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addRoom}>
                <PlusIcon className="size-4" />
                {labels.addRoom}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {rooms.map((room, roomIndex) => (
                <div key={room.id} className="rounded-2xl border border-line bg-canvas p-4">
                  <div className="flex items-center gap-2">
                    <input
                      value={room.name}
                      onChange={(event) => updateRoom(room.id, { name: event.target.value })}
                      placeholder={`${labels.roomNamePlaceholder} ${roomIndex + 1}`}
                      maxLength={60}
                      className={cn(inputClassName, "bg-surface")}
                      aria-label={labels.roomName}
                    />
                    <button
                      type="button"
                      onClick={() => removeRoom(room.id)}
                      disabled={rooms.length === 1}
                      aria-label={labels.removeRoom}
                      className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface text-slate transition hover:border-rejected/40 hover:text-rejected disabled:opacity-40"
                    >
                      <XIcon className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {room.beds.map((bed, bedIndex) => (
                      <div key={bed.id} className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2">
                        <input
                          value={bed.label}
                          onChange={(event) => updateBed(room.id, bed.id, { label: event.target.value })}
                          placeholder={`${labels.bedLabel} ${bedIndex + 1}`}
                          maxLength={40}
                          className={cn(inputClassName, "bg-surface")}
                          aria-label={labels.bedLabel}
                        />
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={1_000_000}
                            step={50}
                            value={bed.price}
                            onChange={(event) => updateBed(room.id, bed.id, { price: Number(event.target.value) })}
                            className={cn(inputClassName, "bg-surface pe-12")}
                            aria-label={labels.bedPrice}
                            dir="ltr"
                          />
                          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-bold text-slate">
                            EGP
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBed(room.id, bed.id)}
                          disabled={room.beds.length === 1}
                          aria-label={labels.removeBed}
                          className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-slate transition hover:border-rejected/40 hover:text-rejected disabled:opacity-40"
                        >
                          <XIcon className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => addBed(room.id)}>
                    <PlusIcon className="size-4" />
                    {labels.addBed}
                  </Button>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] leading-6 text-slate">{labels.requiredHint}</p>
          </section>

          <section id="amenities" className="scroll-mt-24 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <SparkIcon className="size-5 text-teal" />
              {copy.owner.amenities}
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {availableAmenities.map((amenity) => {
                const Icon = amenityIcons[amenity];
                const active = selectedAmenities.includes(amenity);
                return (
                  <label
                    key={amenity}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-xs font-bold transition",
                      active ? "border-teal bg-teal/5 text-teal" : "border-line bg-surface text-slate hover:border-teal/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleAmenity(amenity)}
                      className="size-4 accent-teal"
                    />
                    <Icon className="size-4" />
                    {localize(amenityLabels[amenity], locale)}
                  </label>
                );
              })}
            </div>
          </section>

          <section id="photos" className="scroll-mt-24 rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <UploadIcon className="size-5 text-teal" />
              {copy.owner.photos}
            </h2>

            <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-canvas px-4 py-8 text-center transition hover:border-teal/50">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-teal/10 text-teal">
                <UploadIcon className="size-5" />
              </span>
              <span className="mt-3 block text-sm font-bold">{copy.owner.upload}</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate">{copy.owner.uploadHint}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => selectPhotos(event.target.files)}
                className="sr-only"
              />
            </label>

            {photos.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {photos.map((file) => (
                  <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-[11px] font-bold text-slate">
                    <CheckIcon className="size-4 shrink-0 text-teal" />
                    <span className="truncate">{file.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] leading-6 text-slate">{labels.noPhoto}</p>
            )}
          </section>
        </div>

        <aside className="sticky top-24 space-y-4">
          <section className="rounded-panel border border-line bg-surface p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-display font-bold">
              <SparkIcon className="size-5 text-teal" />
              {copy.owner.summaryTitle}
            </h2>
            <div className="mt-3 flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/70 via-mint/30 to-surface">
              <BedIcon className="size-12 text-teal/40" strokeWidth={1.2} />
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate">{labels.title}</dt>
                <dd className="max-w-[60%] truncate font-bold">{title || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate">{copy.owner.category}</dt>
                <dd className="font-bold">{gender === "male" ? copy.owner.maleCategory : copy.owner.femaleCategory}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate">{labels.bedsTotal}</dt>
                <dd className="font-bold">{totalBeds}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate">{copy.owner.monthlyPrice}</dt>
                <dd className="font-bold text-teal" dir="ltr">
                  {Number.isFinite(minBedPrice) ? `${numberFormatter.format(minBedPrice)} EGP` : "—"}
                </dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-rejected-soft px-3 py-3 text-xs font-bold text-rejected-ink">
                {error}
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <Button type="button" className="w-full" onClick={submit} disabled={pending}>
                <CheckIcon className="size-4" />
                {pending ? labels.uploading : copy.owner.submit}
              </Button>
              <p className="flex items-start gap-1.5 text-[11px] leading-5 text-slate">
                <ShieldIcon className="mt-0.5 size-3.5 shrink-0 text-teal" />
                {copy.owner.submitHint}
              </p>
            </div>
          </section>

          <section className="rounded-panel border border-teal/20 bg-mint/20 p-5">
            <p className="flex items-center gap-2 text-xs font-bold text-teal-dark">
              <ShieldIcon className="size-4" />
              {copy.explore.guarantee}
            </p>
            <p className="mt-2 text-[11px] leading-6 text-slate">{copy.explore.guaranteeBody}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
