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

  test("UT-09 English locale renders Latin digits and English units", () => {
    expect(formatPrice(299, "USD", "en")).toBe("$299")
    expect(formatPrice(299, "EGP", "en")).toBe("299 EGP")
    expect(formatPrice(0, "EGP", "en")).toBe("Free")
    expect(formatPrice(299, "EGP", "ar")).not.toMatch(/299/)
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

  test("UT-13b English durations", () => {
    expect(formatDuration(90, "en")).toBe("1h 30m")
    expect(formatDuration(60, "en")).toBe("1 hour")
    expect(formatDuration(120, "en")).toBe("2 hours")
    expect(formatDuration(1, "en")).toBe("1 minute")
    expect(formatDuration(0, "en")).toBe("0m")
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
