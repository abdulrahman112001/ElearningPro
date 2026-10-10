import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ReceiptText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { loadReceipt } from "@/lib/fees"
import { PrintButton } from "./print-button"

type ReceiptData = NonNullable<Awaited<ReturnType<typeof loadReceipt>>>

/**
 * Printable receipt of a paid group fee. Printing shows only the receipt,
 * whatever dashboard shell surrounds it.
 */
export async function FeeReceipt({ fee, backHref }: { fee: ReceiptData; backHref: string }) {
  const t = await getTranslations("fees.receiptPage")
  const tm = await getTranslations("fees.methods")
  const locale = await getLocale()
  const l = locale === "ar" ? "ar-EG" : "en-US"
  const dateTime = new Intl.DateTimeFormat(l, { timeZone: "Africa/Cairo", dateStyle: "long", timeStyle: "short" })
  const money = new Intl.NumberFormat(l, { maximumFractionDigits: 2 })
  const [y, m] = fee.period.split("-").map(Number)
  const month = new Intl.DateTimeFormat(l, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)))
  const issuer = fee.group.organization?.name ?? fee.group.instructor.name ?? ""

  const rows: [string, React.ReactNode][] = [
    [t("receiptNo"), <span key="r" dir="ltr" className="font-mono">{fee.receiptNo}</span>],
    [t("date"), fee.paidAt ? dateTime.format(fee.paidAt) : "—"],
    [t("student"), fee.student.name ?? fee.student.email],
    [t("group"), fee.group.name],
    [t("month"), month],
    [t("method"), tm(fee.method ?? "CASH")],
    [t("recordedBy"), fee.recordedBy?.name ?? "—"],
  ]

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #fee-receipt, #fee-receipt * { visibility: visible !important; }
        #fee-receipt { position: absolute; top: 0; inset-inline-start: 0; width: 100%; border: none; box-shadow: none; }
      }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="outline">
          <Link href={backHref}>{t("back")}</Link>
        </Button>
        <PrintButton />
      </div>
      <article id="fee-receipt" className="rounded-lg border bg-card p-6 text-card-foreground shadow-soft">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("heading")}</p>
            <h1 className="mt-1 text-xl font-bold">{issuer}</h1>
            {fee.group.organization?.address && <p className="text-sm text-muted-foreground">{fee.group.organization.address}</p>}
            {fee.group.organization?.phone && (
              <p className="text-sm text-muted-foreground" dir="ltr">
                {fee.group.organization.phone}
              </p>
            )}
          </div>
          <ReceiptText className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
        </header>
        <dl className="divide-y">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-end font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-md bg-muted/60 px-4 py-3">
          <span className="font-semibold">{t("amount")}</span>
          <span className="text-2xl font-bold tabular-nums">{t("money", { amount: money.format(fee.amount) })}</span>
        </div>
        {fee.note && <p className="mt-3 text-sm text-muted-foreground">{fee.note}</p>}
        <p className="mt-6 text-center text-xs text-muted-foreground">{t("footer")}</p>
      </article>
    </div>
  )
}
