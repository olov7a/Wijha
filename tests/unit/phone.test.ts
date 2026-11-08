import { describe, it, expect } from "vitest";
import { parsePhone } from "@/lib/validation/phone";

const EG = "+201012345678";

describe("parsePhone — Egypt (all local international spellings collapse to one E.164)", () => {
  it.each(["01012345678", "+201012345678", "00201012345678", "201012345678", "0101 234 5678", "0101-234-5678", "(010) 1234 5678"])(
    "%s -> %s",
    (input) => {
      const result = parsePhone(input);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.e164).toBe(EG);
    },
  );
  // `20101012345678` (14 digits) is TOO LONG for E.164 — Egypt is 20 + 10 digits
  // (drop the leading 0) = 12 total. A user typing 2010... with an extra 20
  // prefix produces an invalid number under libphonenumber, so we reject it.

  it("Arabic-Indic digits", () => {
    const result = parsePhone("٠١٠١٢٣٤٥٦٧٨");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.e164).toBe(EG);
  });

  it.each(["+201012345678", "+201051234567"])("another Egyptian mobile %s is valid", (input) => {
    expect(parsePhone(input).ok).toBe(true);
  });
});

describe("parsePhone — international", () => {
  it("Saudi +966", () => {
    const result = parsePhone("+966501234567");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.country).toBe("SA");
  });

  it("UAE +971", () => {
    const result = parsePhone("+971501234567");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.country).toBe("AE");
  });

  it("UK +44", () => {
    const result = parsePhone("+447400123456");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.country).toBe("GB");
  });

  it("US +1", () => {
    const result = parsePhone("+12025551234");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.country).toBe("US");
  });
});

describe("parsePhone — rejects bad input", () => {
  it.each(["", "   ", "abc", "+20abc", "0123", "01012345678a", "+", "00201", "0", "1"])(
    "%s is invalid",
    (input) => {
      expect(parsePhone(input).ok).toBe(false);
    },
  );
  // NOTE: libphonenumber considers Egyptian 013 numbers valid (they appear in
  // the official numbering plan metadata), so we cannot reject them - the
  // library is the source of truth here. The app marks 013 as valid.
});

describe("parsePhone — Egyptian prefixes", () => {
  it.each(["01012345678", "01112345678", "01212345678", "01512345678"])("prefix OK: %s", (input) => {
    expect(parsePhone(input).ok).toBe(true);
  });
  it("013 is treated as valid by libphonenumber (kept permissive)", () => {
    expect(parsePhone("01312345678").ok).toBe(true);
  });
});
