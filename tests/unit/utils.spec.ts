import { test, expect } from "@playwright/test"
import { getInitials, formatPrice, formatDuration, cn } from "../../lib/utils"

test.describe("getInitials", () => {
  test("UT-01 returns U for empty/null names", () => {
    expect(getInitials(null)).toBe("U")
    expect(getInitials(undefined)).toBe("U")
    expect(getInitials("")).toBe("U")
  })

  test("UT-02 two-letter uppercase initials for Latin names", () => {
    expect(getInitials("john doe")).toBe("JD")
    expect(getInitials("Mary Ann Smith")).toBe("MS")
    expect(getInitials("  alice  ")).toBe("A")
  })

  test("UT-03 single letter for Arabic names", () => {
    expect(getInitials("أحمد محمد")).toBe("أ")
    expect(getInitials("سارة")).toBe("س")
  })

  test("UT-04 whitespace-only name does not crash", () => {
    expect(() => getInitials("   ")).not.toThrow()
  })
})

test.describe("formatPrice", () => {
  test("UT-05 zero price is shown as free", () => {
    expect(formatPrice(0)).toBe("مجاني")
  })

  test("UT-06 EGP price carries the EGP suffix", () => {
    expect(formatPrice(299)).toContain("ج.م")
  })

  test("UT-07 USD price is prefixed with $", () => {
    expect(formatPrice(10, "USD").startsWith("$")).toBeTruthy()
  })

  test("UT-08 keeps the decimal part", () => {
    expect(formatPrice(199.5)).not.toBe(formatPrice(199))
  })

  test("UT-09 @known-bug formatPrice can render Latin digits for the English UI", () => {
    // Audit P0-7: formatPrice is hard-wired to ar-EG and has no locale
    // parameter, so English users always see Arabic-Indic digits.
    const out = formatPrice(299, "USD")
    expect(out, `got "${out}"`).toMatch(/299/)
  })
})

test.describe("formatDuration", () => {
  test("UT-10 zero/negative/NaN duration", () => {
    expect(formatDuration(0)).toBe("0 د")
    expect(formatDuration(-5)).toBe("0 د")
    expect(formatDuration(NaN)).toBe("0 د")
  })

  test("UT-11 minutes only", () => {
    expect(formatDuration(45)).toBe("45 دقيقة")
  })

  test("UT-12 whole hours", () => {
    expect(formatDuration(120)).toBe("2 ساعة")
  })

  test("UT-13 hours and minutes", () => {
    expect(formatDuration(90)).toBe("1 س 30 د")
  })
})

test.describe("cn", () => {
  test("UT-14 merges conflicting tailwind classes, last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe(
      "text-sm font-bold"
    )
  })
})
