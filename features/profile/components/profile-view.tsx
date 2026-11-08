"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { saveOwnerDocument, updateMyBasicProfile } from "@/app/actions/account";
import { saveStudentDocument, updateStudentProfile } from "@/app/actions/profile";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-field";
import { CheckIcon, DocumentIcon, MailIcon, ShieldIcon, UserIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { actionErrorMessage } from "@/lib/action-errors";
import { getPageCopy } from "@/lib/i18n/pages";
import { roleLabels } from "@/lib/roles";
import type { MyProfile } from "@/features/profile/queries";
import { cn } from "@/lib/cn";

const AMENITIES = ["wifi", "ac", "laundry", "gas", "elevator", "desk", "security"] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function splitList(value: string) {
  return value.split(/[,،]/).map((v) => v.trim()).filter(Boolean);
}

type DocKey = "studentId" | "studentCard" | "ownerId" | "ownership";

function DocBox({
  boxKey,
  label,
  has,
  busy,
  uploadingKey,
  texts,
  onUpload,
}: {
  boxKey: DocKey;
  label: string;
  has: boolean;
  busy: boolean;
  uploadingKey: string | null;
  texts: { uploaded: string; missing: string; saving: string; replace: string; upload: string };
  onUpload: (key: DocKey, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas/60 p-4">
      <p className="text-sm font-bold">{label}</p>
      <p className={cn("mt-1 text-xs font-bold", has ? "text-approved-ink" : "text-slate")}>{has ? texts.uploaded : texts.missing}</p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brown px-4 py-2 text-xs font-bold text-brown-ink hover:bg-brown hover:text-white">
        <DocumentIcon className="size-4" />
        {uploadingKey === boxKey ? texts.saving : has ? texts.replace : texts.upload}
        <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={busy} onChange={(e) => onUpload(boxKey, e)} />
      </label>
    </div>
  );
}

export function ProfileView({ profile }: { profile: MyProfile }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const labels =
    locale === "ar"
      ? {
          title: "بروفايلي",
          sub: "دي بياناتك لوحدك — محدش تاني يقدر يشوفها ولا يعدلها.",
          basic: "البيانات الأساسية",
          name: "الاسم الكامل",
          phone: "رقم الموبايل",
          email: "البريد الإلكتروني",
          role: "الدور",
          readonly: "للقراءة فقط",
          save: "حفظ",
          saving: "بيتم الحفظ...",
          saved: "تم الحفظ.",
          studentSection: "بيانات الطالب الجامعية",
          ownerSection: "مستندات المالك",
          staffNote: "دورك ثابت — تغيير الدور من الأدمن فقط. تقدر تعدل اسمك وموبايلك بس.",
          adminNote: "أنت أدمن — تقدر تغير دور أي مستخدم من /admin.",
          gender: "النوع",
          university: "الجامعة والكلية",
          year: "السنة الدراسية",
          smoker: "مدخن",
          hobbies: "الهوايات (افصل بفاصلة)",
          budgetMin: "أقل ميزانية (ج.م)",
          budgetMax: "أعلى ميزانية (ج.م)",
          areas: "المناطق المفضلة",
          amenities: "المرافق المهمة",
          idDoc: "بطاقة الرقم القومي / الهوية",
          universityCard: "كارنيه الكلية",
          ownership: "عقد/إثبات الملكية",
          upload: "رفع ملف",
          replace: "استبدال",
          uploaded: "تم الرفع",
          missing: "لسه مرفوع",
          docsHint: "الملفات خاصة ولا تظهر للملاك أو الطلاب. PDF/JPG/PNG ≤ 5MB.",
          verifying: "المستندات بانتظار المراجعة",
          verified: "الحساب موثق",
          rejected: "المستندات محتاجة إعادة رفع",
          unknown: "لسه مكملتش بياناتك",
          errorUpload: "فشل رفع الملف. حاول تاني.",
          errorSize: "الملف أكبر من 5 ميجابايت.",
          errorType: "الملف لازم يكون PDF أو JPG أو PNG.",
        }
      : {
          title: "My profile",
          sub: "This is your private data — no one else can see or edit it.",
          basic: "Basic details",
          name: "Full name",
          phone: "Mobile number",
          email: "Email",
          role: "Role",
          readonly: "Read-only",
          save: "Save",
          saving: "Saving...",
          saved: "Saved.",
          studentSection: "Student university details",
          ownerSection: "Owner documents",
          staffNote: "Your role is fixed — only an admin can change it. You can edit your name and phone only.",
          adminNote: "You are an admin — you can change any user's role from /admin.",
          gender: "Gender",
          university: "University and faculty",
          year: "Study year",
          smoker: "Smoker",
          hobbies: "Hobbies (comma separated)",
          budgetMin: "Min budget (EGP)",
          budgetMax: "Max budget (EGP)",
          areas: "Preferred areas",
          amenities: "Important amenities",
          idDoc: "National ID / identity",
          universityCard: "University card",
          ownership: "Ownership contract / proof",
          upload: "Upload",
          replace: "Replace",
          uploaded: "Uploaded",
          missing: "Not uploaded yet",
          docsHint: "Files are private and never shown to owners or students. PDF/JPG/PNG ≤ 5MB.",
          verifying: "Documents are awaiting review",
          verified: "Verified account",
          rejected: "Documents need to be uploaded again",
          unknown: "Profile is incomplete",
          errorUpload: "Upload failed. Try again.",
          errorSize: "File is larger than 5 MB.",
          errorType: "File must be PDF, JPG or PNG.",
        };

  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  // Student form state
  const s = profile.student;
  const [gender, setGender] = useState<"male" | "female">(s?.gender ?? "male");
  const [university, setUniversity] = useState(s?.university ?? "");
  const [studyYear, setStudyYear] = useState(s?.studyYear ? String(s.studyYear) : "");
  const [isSmoker, setIsSmoker] = useState(s?.isSmoker ?? false);
  const [hobbies, setHobbies] = useState(s?.hobbies.join("، ") ?? "");
  const [budgetMin, setBudgetMin] = useState(s?.budgetMinPiastres ? String(Math.round(s.budgetMinPiastres / 100)) : "");
  const [budgetMax, setBudgetMax] = useState(s?.budgetMaxPiastres ? String(Math.round(s.budgetMaxPiastres / 100)) : "");
  const [areas, setAreas] = useState(s?.preferredAreas.join("، ") ?? "");
  const [amenities, setAmenities] = useState<string[]>(s?.preferredAmenities ?? []);

  const [docPaths, setDocPaths] = useState({
    studentId: s?.idDocumentPath ?? null,
    studentCard: s?.universityCardPath ?? null,
    ownerId: profile.owner?.idDocumentPath ?? null,
    ownership: profile.owner?.ownershipProofPath ?? null,
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const verification =
    (profile.role === "student" ? s?.verificationStatus : profile.owner?.verificationStatus) === "approved"
      ? labels.verified
      : (profile.role === "student" ? s?.verificationStatus : profile.owner?.verificationStatus) === "rejected"
        ? labels.rejected
        : (profile.role === "student" ? s?.verificationStatus : profile.owner?.verificationStatus) === "pending"
          ? labels.verifying
          : labels.unknown;

  function saveBasic() {
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await updateMyBasicProfile({ fullName, phone });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.saved);
      router.refresh();
    });
  }

  function saveStudent() {
    setError(""); setNotice("");
    startTransition(async () => {
      const result = await updateStudentProfile({
        fullName, phone, gender,
        university: university || undefined,
        studyYear: studyYear ? Number(studyYear) : null,
        isSmoker,
        hobbies: splitList(hobbies),
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        preferredAreas: splitList(areas),
        preferredAmenities: amenities as (typeof AMENITIES)[number][],
      });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setNotice(labels.saved);
      router.refresh();
    });
  }

  async function upload(key: "studentId" | "studentCard" | "ownerId" | "ownership", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setNotice("");
    if (file.size > MAX_FILE_BYTES) { setError(labels.errorSize); return; }
    if (!DOC_TYPES.includes(file.type)) { setError(labels.errorType); return; }
    setUploading(key);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.userId}/${key}-${Date.now()}.${ext}`;
      const bucket = key === "ownerId" || key === "ownership" ? "ownership-documents" : "id-documents";
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) { setError(labels.errorUpload); return; }
      const result =
        key === "studentId" || key === "studentCard"
          ? await saveStudentDocument({ kind: key === "studentId" ? "id_document" : "university_card", path })
          : await saveOwnerDocument({ kind: key === "ownerId" ? "id_document" : "ownership_proof", path });
      if (!result.ok) { setError(actionErrorMessage(locale, result.error)); return; }
      setDocPaths((cur) => ({ ...cur, [key]: path }));
      setNotice(labels.uploaded);
      router.refresh();
    } finally {
      setUploading(null);
    }
  }

  const docTexts = { uploaded: labels.uploaded, missing: labels.missing, saving: labels.saving, replace: labels.replace, upload: labels.upload };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-teal/10 font-display text-lg font-bold text-teal">
            {(fullName || profile.email || "?").trim().charAt(0) || "?"}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold">{labels.title}</h1>
            <p className="mt-1 text-xs leading-6 text-slate">{labels.sub}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-teal/10 px-3 py-1.5 text-xs font-bold text-teal">
          <ShieldIcon className="size-4" />
          {roleLabels[locale][profile.role]} • {verification}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><UserIcon className="size-5 text-teal" />{labels.basic}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input label={labels.name} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} required />
              <Input label={labels.phone} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" maxLength={16} required />
              <div>
                <p className="text-xs font-bold text-slate">{labels.email} ({labels.readonly})</p>
                <p className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm" dir="ltr"><MailIcon className="size-4 text-teal" />{profile.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate">{labels.role} ({labels.readonly})</p>
                <p className="mt-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm font-bold">{roleLabels[locale][profile.role]}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={profile.role === "student" ? saveStudent : saveBasic} disabled={pending || uploading !== null}>
                {pending ? labels.saving : labels.save}
              </Button>
              {profile.role !== "student" && profile.role !== "owner" && (
                <p className="text-xs text-slate">{profile.role === "admin" ? labels.adminNote : labels.staffNote}</p>
              )}
            </div>
          </Card>

          {profile.role === "student" && (
            <Card className="p-5">
              <h2 className="font-display text-base font-bold">{labels.studentSection}</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Select label={labels.gender} value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
                  <option value="male">{locale === "ar" ? "طالب" : "Male"}</option>
                  <option value="female">{locale === "ar" ? "طالبة" : "Female"}</option>
                </Select>
                <Select label={labels.year} value={studyYear} onChange={(e) => setStudyYear(e.target.value)}>
                  <option value="">—</option>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y}</option>)}
                </Select>
                <Input label={labels.university} value={university} onChange={(e) => setUniversity(e.target.value)} maxLength={160} className="sm:col-span-2" />
                <Input label={labels.hobbies} value={hobbies} onChange={(e) => setHobbies(e.target.value)} maxLength={300} className="sm:col-span-2" />
                <Input label={labels.budgetMin} type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} dir="ltr" className="text-left" />
                <Input label={labels.budgetMax} type="number" min={1} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} dir="ltr" className="text-left" />
                <Input label={labels.areas} value={areas} onChange={(e) => setAreas(e.target.value)} maxLength={300} className="sm:col-span-2" />
                <label className="flex items-center gap-3 text-sm font-bold">
                  <input type="checkbox" checked={isSmoker} onChange={(e) => setIsSmoker(e.target.checked)} className="size-4 accent-teal" />
                  {labels.smoker}
                </label>
              </div>
              <p className="mt-5 text-sm font-bold">{labels.amenities}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {AMENITIES.map((key) => {
                  const active = amenities.includes(key);
                  return (
                    <button key={key} type="button" aria-pressed={active} onClick={() => setAmenities((cur) => (cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]))} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", active ? "border-teal bg-teal/10 text-teal" : "border-line bg-canvas text-slate")}>
                      {copy.explore[key]}
                    </button>
                  );
                })}
              </div>
              <Button type="button" className="mt-5" onClick={saveStudent} disabled={pending}>{pending ? labels.saving : labels.save}</Button>
            </Card>
          )}

          {(profile.role === "student" || profile.role === "owner") && (
            <Card className="p-5">
              <h2 className="font-display text-base font-bold">{profile.role === "student" ? labels.studentSection : labels.ownerSection} — {labels.docsHint}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {profile.role === "student" ? (
                  <>
                    <DocBox boxKey="studentId" label={labels.idDoc} has={Boolean(docPaths.studentId)} busy={uploading !== null} uploadingKey={uploading} texts={docTexts} onUpload={upload} />
                    <DocBox boxKey="studentCard" label={labels.universityCard} has={Boolean(docPaths.studentCard)} busy={uploading !== null} uploadingKey={uploading} texts={docTexts} onUpload={upload} />
                  </>
                ) : (
                  <>
                    <DocBox boxKey="ownerId" label={labels.idDoc} has={Boolean(docPaths.ownerId)} busy={uploading !== null} uploadingKey={uploading} texts={docTexts} onUpload={upload} />
                    <DocBox boxKey="ownership" label={labels.ownership} has={Boolean(docPaths.ownership)} busy={uploading !== null} uploadingKey={uploading} texts={docTexts} onUpload={upload} />
                  </>
                )}
              </div>
            </Card>
          )}

          {error && <p role="alert" className="rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">{error}</p>}
          {notice && <p role="status" className="flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink"><CheckIcon className="size-4" />{notice}</p>}
        </div>
      </div>
    </div>
  );
}
