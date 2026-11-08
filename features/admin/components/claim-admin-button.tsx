"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { claimFirstAdmin } from "@/app/actions/roles";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckIcon, ShieldIcon } from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";

export function ClaimAdminButton() {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const labels =
    locale === "ar"
      ? {
          title: "أدمن أول مرة",
          sub: "لو لسه مفيش أدمن في النظام، ولو معاك كود التفعيل السري بتاع السيرفر، تقدر تخلي حسابك الحالي هو الأدمن بضغطة واحدة. الفرونت لوحده مش هيقدر يخلي حد أدمن.",
          button: "اجعلني أدمن",
          making: "بيتم التفعيل...",
          done: "أنت دلوقتي أدمن لـ WIJHA. هتتحول للوحة الأدمن.",
          exists: "المنصة فيها أدمن بالفعل، أو الكود غلط. اطلب من الأدمن الحالي يرقي حسابك من /admin.",
          code: "كود التفعيل السري (من الباك إند)",
          codePlaceholder: "اكتب الكود السري",
        }
      : {
          title: "First admin setup",
          sub: "If the platform has no admin yet and you know the server bootstrap code, you can make your current signed-in account the admin with one click. The frontend alone can never make anyone an admin.",
          button: "Make me admin",
          making: "Activating...",
          done: "You are now the WIJHA admin. Redirecting to the admin dashboard.",
          exists: "An admin already exists, or the code is wrong. Ask the current admin to promote you from /admin.",
          code: "Bootstrap secret code (from the backend)",
          codePlaceholder: "Enter the secret code",
        };

  function claim() {
    setError("");
    startTransition(async () => {
      const result = await claimFirstAdmin({ code });
      if (!result.ok) {
        setError(
          result.error === "FORBIDDEN"
            ? labels.exists
            : actionErrorMessage(locale, result.error),
        );
        return;
      }
      setDone(true);
      router.refresh();
      router.push("/admin");
    });
  }

  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-approved-soft px-4 py-3 text-sm font-bold text-approved-ink">
        <CheckIcon className="size-4" />
        {labels.done}
      </p>
    );
  }

  return (
    <Card className="mx-auto max-w-xl p-6">
      <div className="grid size-12 place-items-center rounded-2xl bg-teal/10 text-teal">
        <ShieldIcon className="size-6" />
      </div>
      <h1 className="mt-4 font-display text-xl font-bold">{labels.title}</h1>
      <p className="mt-2 text-sm leading-7 text-slate">{labels.sub}</p>
      <label className="mt-5 block text-sm font-bold">
        {labels.code}
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={labels.codePlaceholder}
          dir="ltr"
          className="mt-2 w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-left"
          autoComplete="off"
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-rejected-soft px-4 py-3 text-sm font-bold text-rejected-ink">
          {error}
        </p>
      )}
      <Button type="button" size="lg" className="mt-5 w-full" onClick={claim} disabled={pending || code.trim().length < 8}>
        <ShieldIcon className="size-4" />
        {pending ? labels.making : labels.button}
      </Button>
    </Card>
  );
}
