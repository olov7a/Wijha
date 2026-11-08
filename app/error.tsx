"use client";

import { useEffect } from "react";
import { Brand } from "@/components/layout/brand";
import { SiteControls } from "@/components/layout/site-controls";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <SiteControls />
        </div>

        <span className="mt-8 inline-flex rounded-full bg-rejected-soft px-3 py-1 text-xs font-bold text-rejected-ink">
          {t.error.chip}
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">{t.error.heading}</h1>
        <p className="mt-3 text-sm leading-7 text-slate">{t.error.body}</p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={() => retry()}>
            {t.error.retry}
          </Button>
          <ButtonLink href="/" variant="secondary" size="lg">
            {t.error.home}
          </ButtonLink>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-slate">
            {t.error.errorId} <span dir="ltr">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
