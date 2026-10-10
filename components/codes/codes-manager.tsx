"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { CheckCircle2, ChevronLeft, ChevronRight, KeyRound, Layers, Ticket } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  StatusBadge,
  TableSkeleton,
} from "@/components/shared"
import { CreateBatchDialog, type CodesScope } from "./create-batch-dialog"
import { batchTarget, type BatchSummary } from "./batch-utils"

export function CodesManager({ scope }: { scope: CodesScope }) {
  const t = useTranslations("accessCodes")
  const locale = useLocale()
  const router = useRouter()
  const [batches, setBatches] = React.useState<BatchSummary[] | null>(null)
  const [error, setError] = React.useState(false)
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const base = scope === "admin" ? "/admin/codes" : "/instructor/codes"
  const Chevron = locale === "ar" ? ChevronLeft : ChevronRight

  const load = React.useCallback(() => {
    fetch(`/api/${scope}/codes`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => setBatches(d.batches))
      .catch(() => {
        setError(true)
        setBatches([])
      })
  }, [scope])
  React.useEffect(load, [load])

  const totals = (batches ?? []).reduce(
    (a, b) => ({ total: a.total + b.quantity, used: a.used + b.used }),
    { total: 0, used: 0 }
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KeyRound}
        title={t("title")}
        description={scope === "admin" ? t("adminSubtitle") : t("subtitle")}
        actions={<CreateBatchDialog scope={scope} onCreated={(b) => router.push(`${base}/${b.id}`)} />}
      />

      {batches === null ? (
        <StatGridSkeleton count={3} className="lg:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard label={t("statBatches")} value={nf.format(batches.length)} icon={Layers} tone="info" />
          <StatCard label={t("statCodes")} value={nf.format(totals.total)} icon={Ticket} tone="primary" />
          <StatCard label={t("statUsed")} value={nf.format(totals.used)} icon={CheckCircle2} tone="success" />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("loadError")}
        </p>
      )}

      <SectionCard title={t("batches")} contentClassName="p-0">
        {batches === null ? (
          <TableSkeleton rows={4} />
        ) : batches.length === 0 ? (
          <EmptyState variant="plain" icon={KeyRound} title={t("noBatches")} description={t("noBatchesHint")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("batch")}</TableHead>
                  <TableHead>{t("form.type")}</TableHead>
                  <TableHead className="min-w-[9rem]">{t("usage")}</TableHead>
                  <TableHead>{t("expires")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">{t("open")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`${base}/${b.id}`)}>
                    <TableCell>
                      <Link href={`${base}/${b.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{batchTarget(b, t, locale)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.type} label={t(`types.${b.type}`)} tone="info" dot={false} />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                          {t("usedOf", { used: nf.format(b.used), total: nf.format(b.quantity) })}
                        </span>
                        <Progress value={b.quantity ? (b.used / b.quantity) * 100 : 0} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {b.expiresAt ? (
                        b.expired ? (
                          <StatusBadge status="EXPIRED" label={t("status.EXPIRED")} />
                        ) : (
                          dateFmt.format(new Date(b.expiresAt))
                        )
                      ) : (
                        <span className="text-muted-foreground">{t("noExpiry")}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {dateFmt.format(new Date(b.createdAt))}
                      {scope === "admin" && b.createdBy?.name && <span className="block">{b.createdBy.name}</span>}
                    </TableCell>
                    <TableCell>
                      <Chevron className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
