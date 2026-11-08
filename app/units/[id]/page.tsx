import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { UnitBookingCard } from "@/features/units/components/unit-booking-card";
import { amenities } from "@/features/units/components/unit-amenity";
import {
  BedIcon,
  CheckIcon,
  ChevronLeftIcon,
  HeartIcon,
  MapPinIcon,
  ShareIcon,
  ShieldIcon,
  StarIcon,
} from "@/components/ui/icons";
import { GenderBadge, Rating, VerifiedBadge } from "@/components/ui/status";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { amenityLabels, localize, type SampleUnit } from "@/lib/sample-data";
import { getUnitView } from "@/features/units/queries";
import { getApprovedUnitReviews, getReviewGate } from "@/features/reviews/queries";
import { ReviewForm } from "@/features/reviews/components/review-form";
import { cn } from "@/lib/cn";

const toneStyles: Record<SampleUnit["imageTone"], string> = {
  mint: "from-mint/80 via-mint/40 to-canvas",
  sand: "from-amber-200/80 via-amber-100/40 to-canvas dark:from-amber-500/30 dark:via-amber-500/10",
  rose: "from-rose-200/80 via-rose-100/40 to-canvas dark:from-rose-500/30 dark:via-rose-500/10",
  sky: "from-sky-200/80 via-sky-100/40 to-canvas dark:from-sky-500/30 dark:via-sky-500/10",
  olive: "from-lime-200/80 via-lime-100/40 to-canvas dark:from-lime-500/30 dark:via-lime-500/10",
  clay: "from-orange-200/80 via-orange-100/40 to-canvas dark:from-orange-500/30 dark:via-orange-500/10",
  teal: "from-teal/40 via-mint/30 to-canvas dark:from-teal/50 dark:via-teal/20",
  amber: "from-yellow-200/80 via-yellow-100/40 to-canvas dark:from-yellow-500/30 dark:via-yellow-500/10",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const unit = await getUnitView(id);
  const { locale } = await getI18n();

  return unit ? { title: localize(unit.name, locale) } : {};
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getUnitView(id);
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);

  if (!unit) notFound();

  const name = localize(unit.name, locale);
  const rules =
    locale === "ar"
      ? [
          unit.gender === "female"
            ? "السكن مخصص للطالبات فقط ولا يسمح بدخول زوار من الرجال."
            : "السكن مخصص للطلاب فقط، والزيارات العائلية تكون في المساحات المشتركة.",
          "مواعيد عودة هادئة بعد الساعة 11 مساءً حفاظاً على راحة الزملاء.",
          "يمنع التدخين نهائياً داخل الغرف والمساحات المغلقة.",
          "الالتزام بنظافة المساحات المشتركة بعد الاستخدام.",
        ]
      : [
          unit.gender === "female"
            ? "Female students only. Male visitors are not allowed."
            : "Male students only. Family visits take place in shared areas.",
          "Quiet hours after 11 pm to protect your roommates' rest.",
          "Smoking is strictly forbidden inside rooms and enclosed areas.",
          "Leave shared spaces clean after every use.",
        ];

  const reviews = await getApprovedUnitReviews(unit.id);
  const reviewGate = await getReviewGate(unit.id);

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
            <Link href="/" className="hover:text-teal">
              {copy.nav.home}
            </Link>
            <ChevronLeftIcon className="size-4" />
            <Link href="/explore" className="hover:text-teal">
              {copy.nav.explore}
            </Link>
            <ChevronLeftIcon className="size-4" />
            <span className="max-w-[240px] truncate font-bold text-ink sm:max-w-none">{name}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <VerifiedBadge />
            <GenderBadge gender={unit.gender} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pending-soft px-3 py-1 text-xs font-bold text-pending-ink">
              <StarIcon className="size-3.5 fill-current" />
              <span dir="ltr">{unit.rating.toFixed(1)}</span>
              <span className="font-normal">({unit.reviews} {copy.unit.reviews})</span>
            </span>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="max-w-3xl">
              <h1 className="font-display text-2xl font-bold leading-relaxed sm:text-3xl">{name}</h1>
              <p className="mt-3 flex items-start gap-2 text-sm leading-7 text-slate">
                <MapPinIcon className="mt-1 size-4 shrink-0 text-teal" />
                {localize(unit.address, locale)}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-bold transition hover:border-teal hover:text-teal">
                <ShareIcon className="size-4" />
                {copy.unit.share}
              </button>
              <button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-bold transition hover:border-brown hover:text-brown-ink">
                <HeartIcon className="size-4" />
                {copy.unit.save}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1.8fr_1fr]">
            <div
              className={cn(
                "relative min-h-[280px] overflow-hidden rounded-panel border border-line bg-gradient-to-br sm:min-h-[390px]",
                toneStyles[unit.imageTone],
              )}
            >
              { unit.photoUrls[0] ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${unit.photoUrls[0]})` }}
                  aria-hidden="true"
                />
              ) : null }
              <div className="absolute inset-0 blueprint opacity-10" />
              {unit.photoUrls.length === 0 ? (
                <div className="absolute inset-0 grid place-items-center text-teal/35">
                  <BedIcon className="size-24" strokeWidth={1} />
                </div>
              ) : null}
              <span className="absolute bottom-4 start-4 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-bold shadow-sm backdrop-blur">
                {localize(unit.roomTypeLabel, locale)}
              </span>
              <span className="absolute bottom-4 end-4 rounded-full bg-strong/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                {copy.unit.allPhotos} ({unit.reviews})
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {[0, 1].map((index) => {
                const photo = unit.photoUrls[index + 1];
                return (
                  <div
                    key={index}
                    className="relative min-h-24 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-mint/50 via-canvas to-surface lg:min-h-0"
                  >
                    {photo ? (
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${photo})` }}
                        aria-hidden="true"
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 blueprint opacity-10" />
                        <div className="absolute inset-0 grid place-items-center text-teal/25">
                          <BedIcon className="size-10" strokeWidth={1.2} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:grid-cols-4">
            {[
              { icon: <BedIcon className="size-5" />, label: copy.unit.room, value: localize(unit.roomTypeLabel, locale) },
              {
                icon: <BedIcon className="size-5" />,
                label: copy.unit.availableBeds,
                value: `${unit.availableBeds} / ${unit.totalBeds}`,
              },
              { icon: <MapPinIcon className="size-5" />, label: localize(unit.distance, locale) ? copy.unit.distance : copy.explore.area, value: localize(unit.distance, locale) || localize(unit.area, locale) },
              {
                icon: <ShieldIcon className="size-5" />,
                label: copy.unit.owner,
                value: unit.ownerResponse
                  ? `${localize(unit.owner, locale)} · ${unit.ownerResponse}%`
                  : localize(unit.owner, locale),
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal/10 text-teal">{item.icon}</span>
                <div>
                  <p className="text-[11px] text-slate">{item.label}</p>
                  <p className="mt-0.5 text-xs font-bold leading-5">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">
            <div className="space-y-8">
              <section>
                <h2 className="font-display text-xl font-bold">{copy.unit.about}</h2>
                <p className="mt-3 text-sm leading-8 text-slate">{localize(unit.description, locale)}</p>
              </section>

              <section>
                <h2 className="font-display text-xl font-bold">{copy.unit.amenities}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {unit.amenities.map((amenity) => {
                    const Icon = amenities[amenity];
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold shadow-sm"
                      >
                        <span className="grid size-9 place-items-center rounded-xl bg-mint/30 text-teal-dark">
                          <Icon className="size-5" />
                        </span>
                        {localize(amenityLabels[amenity], locale)}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="font-display text-xl font-bold">{copy.unit.location}</h2>
                <div
                  role="img"
                  aria-label={copy.unit.locationAria}
                  className="relative mt-4 h-56 overflow-hidden rounded-panel border border-line bg-mint/15 blueprint"
                >
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="flex flex-col items-center gap-2 rounded-2xl bg-surface/95 px-5 py-4 text-center shadow-card backdrop-blur">
                      <MapPinIcon className="size-6 text-brown-ink" />
                      <span className="text-sm font-bold">{localize(unit.area, locale)}</span>
                      <span className="text-xs text-slate">{localize(unit.distance, locale)}</span>
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="font-display text-xl font-bold">{copy.unit.rules}</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-panel border border-line bg-surface p-5 shadow-card">
                    <h3 className="flex items-center gap-2 font-display font-bold">
                      <CheckIcon className="size-5 text-teal" />
                      {copy.unit.rulesTitle}
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-slate">
                      {rules.map((rule) => (
                        <li key={rule} className="flex gap-2">
                          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-panel border border-teal/20 bg-mint/20 p-5">
                    <h3 className="flex items-center gap-2 font-display font-bold text-teal-dark">
                      <ShieldIcon className="size-5" />
                      {copy.unit.guaranteeTitle}
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-slate">
                      {[
                        copy.explore.guaranteeBody,
                        copy.booking.policyBody,
                        locale === "ar"
                          ? "عقد إيجار إلكتروني موثق يحفظ حقوق الطالب وولي الأمر."
                          : "A verified e-rental contract that protects the student and guardian.",
                      ].map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckIcon className="mt-1 size-4 shrink-0 text-approved" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section id="reviews">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="font-display text-xl font-bold">{copy.unit.reviewsTitle}</h2>
                  <Rating value={unit.rating} />
                </div>

                <div className="mt-4 space-y-4">
                  {reviewGate.status === "eligible" && <ReviewForm unitId={unit.id} />}

                  {(reviewGate.status === "pending" ||
                    reviewGate.status === "approved" ||
                    reviewGate.status === "rejected") && (
                    <p className="rounded-panel border border-line bg-surface px-4 py-3 text-xs font-bold text-slate shadow-card">
                      {locale === "ar"
                        ? reviewGate.status === "pending"
                          ? "تقييمك اتبعت وهو بانتظار مراجعة فريق وجهة."
                          : reviewGate.status === "approved"
                            ? "تقييمك اتعتمد ومنشور على الصفحة."
                            : "تقييمك ما اتعتمدش. تقدر تتواصل مع الدعم لو محتاج توضيح."
                        : reviewGate.status === "pending"
                          ? "Your review was sent and is awaiting WIJHA moderation."
                          : reviewGate.status === "approved"
                            ? "Your review is approved and published."
                            : "Your review was not approved. Contact support if you need details."}
                    </p>
                  )}

                  {reviews.length === 0 ? (
                    <p className="rounded-panel border border-dashed border-line bg-surface px-5 py-8 text-center text-sm leading-7 text-slate">
                      {locale === "ar"
                        ? "لسه مفيش تقييمات معتمدة للوحدة دي. أول تقييم بيظهر بعد ما طالب يقيم إقامته ويتم اعتماده."
                        : "No approved reviews yet. The first review appears after a student rates their stay and it is moderated."}
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {reviews.map((review) => (
                        <article key={review.id} className="rounded-panel border border-line bg-surface p-5 shadow-card">
                          <div className="flex items-center gap-3">
                            <span className="grid size-10 place-items-center rounded-full bg-mint/40 text-sm font-bold text-teal-dark">
                              {locale === "ar" ? "ط" : "S"}
                            </span>
                            <div>
                              <p className="text-sm font-bold">
                                {locale === "ar" ? "طالب موثق" : "Verified student"}
                              </p>
                              <p className="flex items-center gap-1.5 text-[11px] text-slate">
                                <span dir="ltr">{review.rating}</span>
                                <StarIcon className="size-3 fill-pending text-pending" />
                                <span>·</span>
                                <span dir="ltr">
                                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
                                    dateStyle: "medium",
                                  }).format(new Date(review.createdAt))}
                                </span>
                              </p>
                            </div>
                          </div>
                          {review.body && (
                            <p className="mt-3 text-sm leading-7 text-slate">“{review.body}”</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <UnitBookingCard unit={unit} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
