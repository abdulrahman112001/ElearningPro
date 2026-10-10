"use client"

import * as React from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Ban, CheckCircle2, Copy, Download, KeyRound, Printer, Search, Ticket, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  StatusBadge,
  TableSkeleton,
  type Tone,
} from "@/components/shared"
import type { CodesScope } from "./create-batch-dialog"
import { batchTarget, type BatchSummary } from "./batch-utils"

type CodeStatus = "AVAILABLE" | "REDEEMED" | "DISABLED" | "EXPIRED"

interface CodeRow {
  id: string
  code: string
  status: CodeStatus
  redeemedAt: string | null
  redeemedBy: { id: string; name: string | null; email: string } | null
}

type Detail = BatchSummary & { codes: CodeRow[] }

const STATUS_TONE: Record<CodeStatus, Tone> = {
  AVAILABLE: "success",
  REDEEMED: "info",
  DISABLED: "neutral",
  EXPIRED: "danger",
}

export function BatchDetail({ scope, batchId }: { scope: CodesScope; batchId: string }) {
  const t = useTranslations("accessCodes")
  const locale = useLocale()
  const [batch, setBatch] = React.useState<Detail | null>(null)
  const [notFound, setNotFound] = React.useState(false)
  const [filter, setFilter] = React.useState<"ALL" | CodeStatus>("ALL")
  const [q, setQ] = React.useState("")
  const [confirmAll, setConfirmAll] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })
  const api = `/api/${scope}/codes/${batchId}`
  const base = scope === "admin" ? "/admin/codes" : "/instructor/codes"

  const load = React.useCallback(() => {
    fetch(api)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => d && setBatch(d))
      .catch(() => toast.error(t("loadError")))
  }, [api, t])
  React.useEffect(load, [load])

  const toggleCode = async (c: CodeRow) => {
    setBusy(c.id)
    try {
      const res = await fetch(`${api}/codes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: c.status !== "DISABLED" }),
      })
      if (!res.ok) throw new Error()
      toast.success(c.status === "DISABLED" ? t("codeEnabled") : t("codeDisabled"))
      load()
    } catch {
      toast.error(t("actionError"))
    } finally {
      setBusy(null)
    }
  }

  const disableAll = async () => {
    setBusy("all")
    try {
      const res = await fetch(api, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      toast.success(t("batchDisabled", { count: d.disabled }))
      setConfirmAll(false)
      load()
    } catch {
      toast.error(t("actionError"))
    } finally {
      setBusy(null)
    }
  }

  if (notFound) {
    return (
      <EmptyState
        icon={KeyRound}
        title={t("batchNotFound")}
        action={
          <Button asChild variant="outline">
            <Link href={base}>{t("backToBatches")}</Link>
          </Button>
        }
      />
    )
  }

  const counts = batch
    ? batch.codes.reduce<Record<CodeStatus, number>>(
        (a, c) => ({ ...a, [c.status]: a[c.status] + 1 }),
        { AVAILABLE: 0, REDEEMED: 0, DISABLED: 0, EXPIRED: 0 }
      )
    : null
  const needle = q.trim().toUpperCase().replace(/[\s-]/g, "")
  const rows = (batch?.codes ?? []).filter(
    (c) =>
      (filter === "ALL" || c.status === filter) &&
      (!needle ||
        c.code.replace(/-/g, "").includes(needle) ||
        c.redeemedBy?.name?.toUpperCase().includes(q.trim().toUpperCase()) ||
        c.redeemedBy?.email.toUpperCase().includes(q.trim().toUpperCase()))
  )

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KeyRound}
        title={batch?.name ?? t("title")}
        description={batch ? batchTarget(batch, t, locale) : undefined}
        breadcrumbs={[{ label: t("title"), href: base }, { label: batch?.name ?? "…" }]}
        actions={
          batch && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`${api}/export`} download>
                  <Download aria-hidden="true" />
                  {t("exportCsv")}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}/${batchId}/print`}>
                  <Printer aria-hidden="true" />
                  {t("printCards")}
                </Link>
              </Button>
              {counts && counts.AVAILABLE + counts.EXPIRED > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setConfirmAll(true)}>
                  <Ban aria-hidden="true" />
                  {t("disableBatch")}
                </Button>
              )}
            </div>
          )
        }
      />

      {!batch || !counts ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={t("statCodes")} value={nf.format(batch.codes.length)} icon={Ticket} tone="primary" />
          <StatCard label={t("status.AVAILABLE")} value={nf.format(counts.AVAILABLE)} icon={CheckCircle2} tone="success" />
          <StatCard label={t("status.REDEEMED")} value={nf.format(counts.REDEEMED)} icon={KeyRound} tone="info" />
          <StatCard label={t("status.DISABLED")} value={nf.format(counts.DISABLED + counts.EXPIRED)} icon={XCircle} tone="danger" />
        </div>
      )}

      <SectionCard
        title={t("codes")}
        contentClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchCodes")}
                aria-label={t("searchCodes")}
                className="h-9 w-44 ps-8"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              aria-label={t("filterStatus")}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="ALL">{t("allStatuses")}</option>
              {(["AVAILABLE", "REDEEMED", "DISABLED", "EXPIRED"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {!batch ? (
          <TableSkeleton rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={Search} title={t("noCodesMatch")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("statusLabel")}</TableHead>
                  <TableHead>{t("redeemedBy")}</TableHead>
                  <TableHead>{t("redeemedAt")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-sm" dir="ltr">
                        {c.code}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={t("copyCode")}
                          onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast.success(t("copied")), () => {})}
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} label={t(`status.${c.status}`)} tone={STATUS_TONE[c.status]} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.redeemedBy ? (
                        <>
                          <span className="block">{c.redeemedBy.name ?? "—"}</span>
                          <span className="block text-xs text-muted-foreground" dir="ltr">
                            {c.redeemedBy.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {c.redeemedAt ? dateFmt.format(new Date(c.redeemedAt)) : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      {(c.status === "AVAILABLE" || c.status === "DISABLED") && (
                        <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => toggleCode(c)}>
                          {c.status === "DISABLED" ? t("enable") : t("disable")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <AlertDialog open={confirmAll} onOpenChange={(o) => busy !== "all" && setConfirmAll(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableBatchTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("disableBatchBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "all"}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "all"}
              onClick={(e) => {
                e.preventDefault()
                disableAll()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("disableBatch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
