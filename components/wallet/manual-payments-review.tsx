"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { AlertTriangle, Banknote, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AvatarName, EmptyState, PageHeader, SectionCard, StatusBadge, TableSkeleton } from "@/components/shared"
import { PaymentSettingsCard } from "./payment-settings-card"

type Status = "PENDING" | "APPROVED" | "REJECTED"

interface Row {
  id: string
  method: string
  amount: number
  reference: string
  senderPhone: string | null
  note: string | null
  status: Status
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string; image: string | null; phone: string | null; walletBalance: number }
  reviewedBy: { id: string; name: string | null } | null
  duplicateOf: { id: string; amount: number; reviewedAt: string | null } | null
}

const METHODS = ["VODAFONE_CASH", "INSTAPAY", "BANK_TRANSFER", "FAWRY", "CASH"]

export function ManualPaymentsReview() {
  const t = useTranslations("manualPayments")
  const tw = useTranslations("wallet")
  const locale = useLocale()
  const [status, setStatus] = React.useState<Status>("PENDING")
  const [rows, setRows] = React.useState<Row[] | null>(null)
  const [counts, setCounts] = React.useState<Record<Status, number> | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [rejecting, setRejecting] = React.useState<Row | null>(null)
  const [approving, setApproving] = React.useState<Row | null>(null)
  const [reason, setReason] = React.useState("")
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 })
  const money = (v: number) => `${nf.format(v)} ${locale === "ar" ? "ج.م" : "EGP"}`
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })
  const methodLabel = (m: string) => (METHODS.includes(m) ? tw(`methods.${m}`) : m)

  const load = React.useCallback(() => {
    setRows(null)
    fetch(`/api/admin/manual-payments?status=${status}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        setRows(d.payments)
        setCounts(d.counts)
      })
      .catch(() => {
        setRows([])
        toast.error(t("loadError"))
      })
  }, [status, t])
  React.useEffect(load, [load])

  const review = async (row: Row, action: "approve" | "reject") => {
    setBusy(row.id)
    try {
      const res = await fetch(`/api/admin/manual-payments/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "reject" ? reason : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(action === "approve" ? t("approved", { amount: money(row.amount) }) : t("rejected"))
        setRejecting(null)
        setApproving(null)
        setReason("")
        load()
      } else if (data.code === "already_reviewed") {
        toast.error(t("alreadyReviewed"))
        load()
      } else toast.error(t("actionError"))
    } catch {
      toast.error(t("actionError"))
    } finally {
      setBusy(null)
    }
  }

  const label = (s: Status) => (counts ? `${t(`tabs.${s}`)} (${nf.format(counts[s])})` : t(`tabs.${s}`))

  return (
    <div className="space-y-6">
      <PageHeader icon={Banknote} title={t("title")} description={t("subtitle")} />

      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <TabsTrigger key={s} value={s}>
              {label(s)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard contentClassName="p-0">
        {rows === null ? (
          <TableSkeleton rows={4} columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState variant="plain" icon={Banknote} title={t(`empty.${status}`)} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("transfer")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead className="text-end">{status === "PENDING" ? t("actions") : t("review")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="min-w-[12rem]">
                      <AvatarName name={r.user.name} image={r.user.image} secondary={r.user.email} />
                      <p className="mt-1 text-xs text-muted-foreground">{t("currentBalance", { balance: money(r.user.walletBalance) })}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-semibold">{money(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">{methodLabel(r.method)}</p>
                    </TableCell>
                    <TableCell className="min-w-[10rem]">
                      <p className="font-mono text-sm" dir="ltr">
                        {r.reference}
                      </p>
                      {r.senderPhone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {r.senderPhone}
                        </p>
                      )}
                      {r.note && <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{r.note}</p>}
                      {r.duplicateOf && (
                        <p className="mt-1 inline-flex items-start gap-1 rounded bg-warning/10 px-1.5 py-1 text-xs font-medium text-warning">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {t("duplicateWarning")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateFmt.format(new Date(r.createdAt))}</TableCell>
                    <TableCell className="text-end">
                      {r.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setApproving(r)} disabled={busy === r.id}>
                            {busy === r.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                            {t("approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReason("")
                              setRejecting(r)
                            }}
                            disabled={busy === r.id}
                          >
                            <X aria-hidden="true" />
                            {t("reject")}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <StatusBadge status={r.status} label={tw(`requestStatus.${r.status}`)} />
                          {r.reviewedBy?.name && <p className="text-muted-foreground">{r.reviewedBy.name}</p>}
                          {r.reviewNote && <p className="ms-auto max-w-[14rem] text-muted-foreground">{r.reviewNote}</p>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <PaymentSettingsCard />

      <Dialog open={!!approving} onOpenChange={(o) => !o && !busy && setApproving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("approveTitle")}</DialogTitle>
            <DialogDescription>
              {approving && t("approveBody", { amount: money(approving.amount), name: approving.user.name ?? approving.user.email })}
            </DialogDescription>
          </DialogHeader>
          {approving?.duplicateOf && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              {t("duplicateWarningLong")}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproving(null)} disabled={!!busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => approving && review(approving, "approve")} disabled={!!busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && !busy && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>{t("rejectBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">{t("reason")}</Label>
            <Textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={!!busy}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejecting && review(rejecting, "reject")}
              disabled={!!busy || reason.trim().length < 3}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
