export interface BatchSummary {
  id: string
  name: string
  type: "COURSE" | "SUBSCRIPTION" | "WALLET"
  quantity: number
  used: number
  months: number
  value: number
  expiresAt: string | null
  expired: boolean
  createdAt: string
  course: { id: string; titleAr: string; titleEn: string; slug: string } | null
  instructor: { id: string; name: string | null } | null
  createdBy: { id: string; name: string | null; role: string } | null
}

type T = (key: string, values?: Record<string, string | number>) => string

/** "Course: X" / "Teacher subscription · 2 months" / "Wallet credit · 100 EGP". */
export function batchTarget(b: Pick<BatchSummary, "type" | "course" | "instructor" | "months" | "value">, t: T, locale: string) {
  if (b.type === "COURSE") {
    const title = b.course ? (locale === "ar" ? b.course.titleAr || b.course.titleEn : b.course.titleEn || b.course.titleAr) : ""
    return t("target.course", { course: title })
  }
  if (b.type === "SUBSCRIPTION") {
    return t("target.subscription", { teacher: b.instructor?.name ?? "", months: b.months })
  }
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 })
  return t("target.wallet", { amount: nf.format(b.value) })
}
