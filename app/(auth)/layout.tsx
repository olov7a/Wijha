import { Brand } from "@/components/layout/brand";
import { SiteControls } from "@/components/layout/site-controls";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();

  return (
    <main className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="hidden bg-strong p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Brand />
        <div className="max-w-md">
          <p className="text-sm font-bold text-mint">{t.authAside.eyebrow}</p>
          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.6]">{t.authAside.title}</h2>
          <div className="mt-10 space-y-4 text-sm leading-7 text-white/70">
            <p className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-mint" />
              {t.authAside.student}
            </p>
            <p className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-mint" />
              {t.authAside.owner}
            </p>
            <p className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-mint" />
              {t.authAside.team}
            </p>
          </div>
        </div>
        <p className="text-xs text-white/50">{t.authAside.note}</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-8 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-3">
            <div className="lg:hidden">
              <Brand />
            </div>
            <SiteControls className="ms-auto" />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
