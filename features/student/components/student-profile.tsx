"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { signOut } from "@/app/actions/auth";
import { saveStudentDocument, updateStudentProfile } from "@/app/actions/profile";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-field";
import {
  CheckIcon,
  DocumentIcon,
  MailIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import type { StudentProfileDetails } from "@/features/student/queries";
import { cn } from "@/lib/cn";

const AMENITIES = ["wifi", "ac", "laundry", "gas", "elevator", "desk", "security"] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function splitList(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function StudentProfile({ details }: { details: StudentProfileDetails }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(details.fullName ?? "");
  const [phone, setPhone] = useState(details.phone ?? "");
  const [gender, setGender] = useState<"male" | "female">(details.gender ?? "male");
  const [university, setUniversity] = useState(details.university ?? "");
  const [studyYear, setStudyYear] = useState(details.studyYear ? String(details.studyYear) : "");
  const [isSmoker, setIsSmoker] = useState(details.isSmoker);
  const [hobbies, setHobbies] = useState(details.hobbies.join("، "));
  const [budgetMin, setBudgetMin] = useState(
    details.budgetMinPiastres ? String(Math.round(details.budgetMinPiastres / 100)) : "",
  );
  const [budgetMax, setBudgetMax] = useState(
    details.budgetMaxPiastres ? String(Math.round(details.budgetMaxPiastres / 100)) : "",
  );
  const [areas, setAreas] = useState(details.preferredAreas.join("، "));
  const [amenities, setAmenities] = useState<string[]>(details.preferredAmenities);
  const [documentPaths, setDocumentPaths] = useState({
    id_document: details.idDocumentPath,
    university_card: details.universityCardPath,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"id_document" | "university_card" | null>(null);

  const labels =
    locale === "ar"
      ? {
          personal: "البيانات الشخصية",
          personalHint: "نفس البيانات الموجودة في بطاقة الرقم القومي وكارنيه الكلية.",
          name: "الاسم الكامل",
          phone: "رقم الموبايل",
          gender: "النوع",
          male: "طالب",
          female: "طالبة",
          university: "الجامعة والكلية",
          year: "السنة الدراسية",
          smoker: "مدخن",
          hobbies: "الهوايات (افصل بفاصلة)",
          prefs: "تفضيلات السكن والبحث الذكي",
          prefsHint: "بتساعد خوارزمية التوافق ترشح لك وحدات أنسب.",
          budgetMin: "أقل ميزانية شهرية (ج.م)",
          budgetMax: "أعلى ميزانية شهرية (ج.م)",
          areas: "المناطق المفضلة (افصل بفاصلة)",
          amenities: "المرافق المهمة",
          docs: "إثبات الهوية والبطاقة الجامعية",
          docsHint: "الملفات خاصة ولا تظهر للملاك أو الطلاب. PDF أو JPG أو PNG بحد أقصى 5 ميجابايت.",
          idDoc: "بطاقة الرقم القومي",
          universityCard: "كارنيه الكلية",
          upload: "رفع ملف",
          replace: "استبدال الملف",
          uploaded: "تم رفع الملف",
          missing: "لسه مرفوع",
          save: "حفظ التغييرات",
          saving: "بيتم الحفظ...",
          saved: "تم حفظ بياناتك وتفضيلاتك.",
          verified: "الحساب موثق",
          pending: "المستندات بانتظار مراجعة الفريق",
          rejected: "المستندات محتاجة إعادة رفع",
          unknown: "لسه مكملتش بياناتك",
          email: "البريد الإلكتروني",
          logout: "تسجيل الخروج",
          quick: "روابط سريعة",
          bookings: "حجوزاتي",
          recommendations: "الوحدات المتوافقة",
          sizeError: "الملف أكبر من 5 ميجابايت.",
          typeError: "الملف لازم يكون PDF أو JPG أو PNG.",
          uploadError: "فشل رفع الملف. حاول تاني.",
        }
      : {
          personal: "Personal details",
          personalHint: "Use the same data as your national ID and university card.",
          name: "Full name",
          phone: "Mobile number",
          gender: "Gender",
          male: "Male",
          female: "Female",
          university: "University and faculty",
          year: "Study year",
          smoker: "Smoker",
          hobbies: "Hobbies (comma separated)",
          prefs: "Housing and matching preferences",
          prefsHint: "These help the matching engine suggest better units.",
          budgetMin: "Minimum monthly budget (EGP)",
          budgetMax: "Maximum monthly budget (EGP)",
          areas: "Preferred areas (comma separated)",
          amenities: "Important amenities",
          docs: "Identity and university card",
          docsHint: "Files are private and never shown to owners or students. PDF, JPG or PNG up to 5 MB.",
          idDoc: "National ID card",
          universityCard: "University card",
          upload: "Upload file",
          replace: "Replace file",
          uploaded: "File uploaded",
          missing: "Not uploaded yet",
          save: "Save changes",
          saving: "Saving...",
          saved: "Your data and preferences were saved.",
          verified: "Verified account",
          pending: "Documents are waiting for team review",
          rejected: "Documents need to be uploaded again",
          unknown: "Profile is incomplete",
          email: "Email",
          logout: "Sign out",
          quick: "Quick links",
          bookings: "My bookings",
          recommendations: "Matched units",
          sizeError: "The file is larger than 5 MB.",
          typeError: "The file must be PDF, JPG or PNG.",
          uploadError: "Upload failed. Try again.",
        };

  const verification =
    details.verificationStatus === "approved"
      ? labels.verified
      : details.verificationStatus === "rejected"
        ? labels.rejected
        : details.verificationStatus === "pending"
          ? labels.pending
          : labels.unknown;

  function submit() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await updateStudentProfile({
        fullName,
        phone,
        gender,
        university: university || undefined,
        studyYear: studyYear ? Number(studyYear) : null,
        isSmoker,
        hobbies: splitList(hobbies),
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        preferredAreas: splitList(areas),
        preferredAmenities: amenities as (typeof AMENITIES)[number][],
      });

      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }

      setMessage(labels.saved);
      router.refresh();
    });
  }

  async function upload(kind: "id_document" | "university_card", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setMessage("");

    if (file.size > MAX_FILE_BYTES) {
      setError(labels.sizeError);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(labels.typeError);
      return;
    }

    setUploading(kind);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${details.userId}/${kind}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("id-documents").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        setError(labels.uploadError);
        return;
      }

      const result = await saveStudentDocument({ kind, path });
      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }

      setDocumentPaths((current) => ({ ...current, [kind]: path }));
      setMessage(labels.uploaded);
      router.refresh();
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-teal/10 font-display text-lg font-bold text-teal">
            {(fullName || details.email || "?").trim().charAt(0)}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold">{copy.profile.title}</h1>
            <p className="mt-1 text-xs leading-6 text-slate">{copy.profile.subtitle}</p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
            details.verificationStatus === "approved"
              ? "bg-approved-soft text-approved-ink"
              : details.verificationStatus === "rejected"
                ? "bg-rejected-soft text-rejected-ink"
                : "bg-pending-soft text-pending-ink",
          )}
        >
          <ShieldIcon className="size-4" />
          {verification}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <UserIcon className="size-5 text-teal" />
              {labels.personal}
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate">{labels.personalHint}</p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input label={labels.name} value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} required />
              <Input
                label={labels.phone}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                dir="ltr"
                className="text-left"
                maxLength={16}
                required
              />
              <Select label={labels.gender} value={gender} onChange={(event) => setGender(event.target.value as "male" | "female")}>
                <option value="male">{labels.male}</option>
                <option value="female">{labels.female}</option>
              </Select>
              <Select label={labels.year} value={studyYear} onChange={(event) => setStudyYear(event.target.value)}>
                <option value="">—</option>
                {Array.from({ length: 8 }, (_, index) => index + 1).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
              <Input
                label={labels.university}
                value={university}
                onChange={(event) => setUniversity(event.target.value)}
                maxLength={160}
                className="sm:col-span-2"
              />
              <Input
                label={labels.hobbies}
                value={hobbies}
                onChange={(event) => setHobbies(event.target.value)}
                maxLength={300}
                className="sm:col-span-2"
              />
              <label className="flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={isSmoker}
                  onChange={(event) => setIsSmoker(event.target.checked)}
                  className="size-4 accent-teal"
                />
                {labels.smoker}
              </label>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold">{labels.prefs}</h2>
            <p className="mt-1 text-xs leading-6 text-slate">{labels.prefsHint}</p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input
                label={labels.budgetMin}
                type="number"
                min={0}
                value={budgetMin}
                onChange={(event) => setBudgetMin(event.target.value)}
                dir="ltr"
                className="text-left"
              />
              <Input
                label={labels.budgetMax}
                type="number"
                min={1}
                value={budgetMax}
                onChange={(event) => setBudgetMax(event.target.value)}
                dir="ltr"
                className="text-left"
              />
              <Input
                label={labels.areas}
                value={areas}
                onChange={(event) => setAreas(event.target.value)}
                maxLength={300}
                className="sm:col-span-2"
              />
            </div>

            <p className="mt-5 text-sm font-bold">{labels.amenities}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AMENITIES.map((key) => {
                const active = amenities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setAmenities((current) =>
                        current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      active
                        ? "border-teal bg-teal/10 text-teal"
                        : "border-line bg-canvas text-slate hover:border-teal",
                    )}
                  >
                    {copy.explore[key]}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <DocumentIcon className="size-5 text-teal" />
              {labels.docs}
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate">{labels.docsHint}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["id_document", labels.idDoc],
                  ["university_card", labels.universityCard],
                ] as const
              ).map(([kind, label]) => {
                const uploaded = Boolean(documentPaths[kind]);
                return (
                  <div key={kind} className="rounded-2xl border border-line bg-canvas/60 p-4">
                    <p className="text-sm font-bold">{label}</p>
                    <p className={cn("mt-1 text-xs font-bold", uploaded ? "text-approved-ink" : "text-slate")}>
                      {uploaded ? labels.uploaded : labels.missing}
                    </p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brown px-4 py-2 text-xs font-bold text-brown-ink transition hover:bg-brown hover:text-white">
                      <DocumentIcon className="size-4" />
                      {uploading === kind ? labels.saving : uploaded ? labels.replace : labels.upload}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="sr-only"
                        disabled={uploading !== null}
                        onChange={(event) => upload(kind, event)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>

          {error && (
            <p role="alert" className="rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink">
              <CheckIcon className="size-4" />
              {message}
            </p>
          )}

          <Button type="button" size="lg" onClick={submit} disabled={pending || uploading !== null}>
            {pending ? labels.saving : labels.save}
          </Button>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-bold text-slate">{labels.email}</p>
            <p className="mt-1 flex items-center gap-2 break-all text-sm font-bold" dir="ltr">
              <MailIcon className="size-4 shrink-0 text-teal" />
              {details.email ?? "—"}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-bold text-slate">{labels.quick}</p>
            <div className="mt-3 space-y-2 text-sm font-bold text-teal">
              <Link className="block hover:underline" href="/student">
                {labels.bookings}
              </Link>
              <Link className="block hover:underline" href="/student/recommendations">
                {labels.recommendations}
              </Link>
              <Link className="block hover:underline" href="/explore">
                {copy.nav.explore}
              </Link>
            </div>
          </Card>

          <form action={signOut}>
            <Button type="submit" variant="secondary" className="w-full">
              {labels.logout}
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
