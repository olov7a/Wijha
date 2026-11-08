"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/providers/locale-provider";

export function Brand({ href = "/" }: { href?: string }) {
  const { t } = useI18n();

  return (
    <Link href={href} className="inline-flex items-center p-1" aria-label={t.common.brandHome}>
      <Image
        src="/images/wijha-logo.png"
        alt="WIJHA - وجهة"
        width={349}
        height={321}
        sizes="64px"
        className="h-16 w-auto"
      />
    </Link>
  );
}
