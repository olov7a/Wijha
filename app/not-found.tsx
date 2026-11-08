import type { Metadata } from "next";
import { Brand } from "@/components/layout/brand";
import { SiteControls } from "@/components/layout/site-controls";
import { ButtonLink } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.notFound };
}

export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <SiteControls />
        </div>

        <span className="mt-8 inline-grid size-14 place-items-center rounded-2xl bg-mint/30 text-teal-dark">
          <SearchIcon className="size-6" />
        </span>

        <p className="mt-5 font-display text-5xl font-bold text-mint" dir="ltr">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">{t.notFound.heading}</h1>
        <p className="mt-3 text-sm leading-7 text-slate">{t.notFound.body}</p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" size="lg">
            {t.notFound.home}
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            {t.notFound.login}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
