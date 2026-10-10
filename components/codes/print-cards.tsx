import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { getBatchFor, type CodeActor } from "@/lib/codes"
import { PrintButton } from "./print-button"
import { batchTarget } from "./batch-utils"

/**
 * Printable scratch-card sheet: available codes only, 3 per row on A4
 * (4 on wider paper), dashed cut lines. The dashboard shell is hidden when
 * printing.
 */
export async function PrintCards({ actor, batchId, scope }: { actor: CodeActor; batchId: string; scope: "instructor" | "admin" }) {
  const t = await getTranslations("accessCodes")
  const locale = await getLocale()
  const base = scope === "admin" ? "/admin/codes" : "/instructor/codes"
  let batch
  try {
    batch = await getBatchFor(actor, batchId)
  } catch {
    return <p className="text-sm text-muted-foreground">{t("batchNotFound")}</p>
  }
  const expired = !!batch.expiresAt && batch.expiresAt.getTime() <= Date.now()
  const codes = expired
    ? []
    : await db.accessCode.findMany({
        where: { batchId, redeemedById: null, disabled: false },
        orderBy: { code: "asc" },
        select: { id: true, code: true },
      })
  const target = batchTarget(batch, t, locale)
  const teacher = batch.instructor?.name ?? ""
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")
  const Back = locale === "ar" ? ArrowRight : ArrowLeft

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute; inset-inline-start: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .code-card { break-inside: avoid; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("printTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {batch.name} · {t("printCount", { count: codes.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/${batchId}`}>
              <Back aria-hidden="true" />
              {t("backToBatch")}
            </Link>
          </Button>
          <PrintButton label={t("print")} disabled={codes.length === 0} />
        </div>
      </div>

      {codes.length === 0 ? (
        <p className="no-print rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("printNothing")}
        </p>
      ) : (
        <div className="print-root grid grid-cols-1 bg-white text-black min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3">
          {codes.map((c) => (
            <div
              key={c.id}
              data-code-card
              className="code-card flex min-h-[46mm] flex-col justify-between gap-2 border border-dashed border-gray-400 p-3 text-center"
            >
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("printBrand")}</p>
                <p className="line-clamp-2 text-sm font-bold leading-snug">{target}</p>
                {teacher && batch.type === "COURSE" && <p className="text-xs text-gray-600">{teacher}</p>}
              </div>
              <p className="rounded border-2 border-black px-1 py-1.5 font-mono text-[15px] font-bold tracking-wider" dir="ltr">
                {c.code}
              </p>
              <div className="space-y-0.5 text-[10px] leading-tight text-gray-600">
                <p>{t("printHowTo", { url: appUrl ? `${appUrl}/student/wallet` : "/student/wallet" })}</p>
                {batch.expiresAt && <p>{t("printExpires", { date: dateFmt.format(batch.expiresAt) })}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
