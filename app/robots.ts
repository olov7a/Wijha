import type { MetadataRoute } from "next";

// MVP/test deployment: never let search engines index the site. Kept for
// every environment until the team explicitly launches publicly.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
    host: process.env.NEXT_PUBLIC_SITE_URL,
  };
}
