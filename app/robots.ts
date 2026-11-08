import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (isStaging()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      host: process.env.NEXT_PUBLIC_SITE_URL,
    };
  }
  return { rules: [{ userAgent: "*", allow: "/" }] };
}
