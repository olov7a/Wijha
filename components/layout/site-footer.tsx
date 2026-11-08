import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { CheckIcon, MapPinIcon, WalletIcon } from "@/components/ui/icons";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function SiteFooter() {
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr] lg:px-12 lg:py-16">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm leading-7 text-slate">{copy.footer.about}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-approved-soft px-3 py-1.5 text-xs font-bold text-approved-ink">
            <CheckIcon className="size-4" />
            {copy.footer.trust}
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold">{copy.footer.platform}</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-slate">
            <li>
              <Link href="/explore?area=cairo" className="transition-colors hover:text-teal">
                {copy.footer.nearCairo}
              </Link>
            </li>
            <li>
              <Link href="/explore?area=ain-shams" className="transition-colors hover:text-teal">
                {copy.footer.nearAinShams}
              </Link>
            </li>
            <li>
              <Link href="/explore?gender=female" className="transition-colors hover:text-teal">
                {copy.footer.femaleHousing}
              </Link>
            </li>
            <li>
              <Link href="/explore?room=private" className="transition-colors hover:text-teal">
                {copy.footer.rooms}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold">{copy.footer.support}</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-slate">
            <li>
              <Link href="/#guarantee" className="transition-colors hover:text-teal">
                {copy.footer.refund}
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="transition-colors hover:text-teal">
                {copy.footer.inspection}
              </Link>
            </li>
            <li>
              <Link href="/#guarantee" className="transition-colors hover:text-teal">
                {copy.footer.contract}
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="transition-colors hover:text-teal">
                {copy.footer.faq}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold">{copy.footer.help}</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate">
            <li className="flex items-start gap-2">
              <MapPinIcon className="mt-0.5 size-4 shrink-0 text-teal" />
              {copy.footer.address}
            </li>
            <li className="flex items-center gap-2" dir="ltr">
              <WalletIcon className="size-4 shrink-0 text-teal" />
              {copy.footer.currency}
            </li>
          </ul>
          <Link
            href="/explore"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover"
          >
            {copy.nav.explore}
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© 2025 WIJHA. {copy.footer.rights}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-teal">
              {copy.footer.privacy}
            </Link>
            <Link href="/" className="hover:text-teal">
              {copy.footer.terms}
            </Link>
            <Link href="/" className="hover:text-teal">
              {copy.footer.safety}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
