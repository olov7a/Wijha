import { getI18n } from "@/lib/i18n/server";

/** Shown while a page is loading (Next wraps every segment with this). */
export default async function Loading() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-[40vh] w-full max-w-7xl items-center justify-center px-5 py-16 sm:px-8">
      <p role="status" className="animate-pulse text-sm font-bold text-slate">
        {t.auth.form.pending}
      </p>
    </main>
  );
}
