import { describe, it, expect, afterEach } from "vitest";
import { getEmailRedirectTo, getSiteUrl } from "@/lib/auth/site-url";
import { getRoleHomePath } from "@/lib/auth/role-redirect";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("site-url helpers", () => {
  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
    expect(getEmailRedirectTo()).toBe("http://localhost:3000/auth/callback");
  });

  it("uses NEXT_PUBLIC_SITE_URL and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://wijha-rho.vercel.app/";
    expect(getSiteUrl()).toBe("https://wijha-rho.vercel.app");
    expect(getEmailRedirectTo()).toBe("https://wijha-rho.vercel.app/auth/callback");
  });

  it("always targets the /auth/callback path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
    expect(getEmailRedirectTo().endsWith("/auth/callback")).toBe(true);
  });
});

describe("getRoleHomePath — existing role routes only", () => {
  it("maps every role to its existing dashboard route", () => {
    expect(getRoleHomePath("student")).toBe("/student");
    expect(getRoleHomePath("owner")).toBe("/owner");
    expect(getRoleHomePath("team")).toBe("/team");
    expect(getRoleHomePath("leader")).toBe("/leader");
    expect(getRoleHomePath("admin")).toBe("/admin");
  });

  it("falls back to /dashboard for unknown roles", () => {
    expect(getRoleHomePath(null)).toBe("/dashboard");
    expect(getRoleHomePath(undefined)).toBe("/dashboard");
    expect(getRoleHomePath("superuser")).toBe("/dashboard");
  });
});
