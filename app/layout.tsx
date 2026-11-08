import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { isStaging } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
  fallback: ["Tajawal", "sans-serif"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();

  return {
    title: {
      default: t.meta.title,
      template: `%s | ${t.meta.brand}`,
    },
    description: t.meta.description,
  };
}

const themeScript = `(function(){try{var k="wijha-theme";var s=localStorage.getItem(k);var d=s==="dark"||(s===null&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#07110f":"#f4fbf9");}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, dir } = await getI18n();
  const staging = isStaging();

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f4fbf9" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${cairo.variable} bg-canvas font-body text-ink antialiased`}>
        {staging && (
          <div role="banner" aria-live="polite" className="bg-pending text-pending-ink px-4 py-2 text-center text-xs font-bold">
            Test environment - use fake data only. No real payments.
          </div>
        )}
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
