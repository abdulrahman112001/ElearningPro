"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ArrowDownLeft, ArrowUpRight, History, Landmark, ReceiptText, Ticket, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
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
} from "@/components/shared"
import { RedeemCodeForm } from "@/components/codes/redeem-code-form"
import { TopupForm, type ReceivingAccounts } from "./topup-form"
import { cn } from "@/lib/utils"

interface WalletTx {
  id: string
  type: "CREDIT" | "DEBIT"
  amount: number
  balanceAfter: number
  reason: string
  note: string | null
  createdAt: string
}

interface ManualPaymentRow {
  id: string
  method: string
  amount: number
  reference: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  reviewNote: string | null
  createdAt: string
}

interface WalletData {
  balance: number
  transactions: WalletTx[]
  payments: ManualPaymentRow[]
  receiving: ReceivingAccounts
}

const REASONS = ["code_redeemed", "transfer_approved", "course_purchase", "subscription", "group_fee", "refund", "admin_adjustment"]
const METHODS = ["VODAFONE_CASH", "INSTAPAY", "BANK_TRANSFER", "FAWRY", "CASH"]

export function WalletView() {
  const t = useTranslations("wallet")
  const locale = useLocale()
  const params = useSearchParams()
  const returnTo = params?.get("returnTo") ?? null
  const [data, setData] = React.useState<WalletData | null>(null)
  const [error, setError] = React.useState(false)
  const topupRef = React.useRef<HTMLDivElement>(null)

  const nf = React.useMemo(
    () => new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 2 }),
    [locale]
  )
  const money = (v: number) => `${nf.format(v)} ${locale === "ar" ? "ج.م" : "EGP"}`
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" })

  const load = React.useCallback(() => {
    fetch("/api/wallet")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: WalletData) => {
        setData(d)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])
  React.useEffect(load, [load])

  React.useEffect(() => {
    if (params?.get("topup") && data) topupRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [params, data])

  const reasonLabel = (r: string) => (REASONS.includes(r) ? t(`reasons.${r}`) : r)
  const methodLabel = (m: string) => (METHODS.includes(m) ? t(`methods.${m}`) : m)
  const pending = data?.payments.filter((p) => p.status === "PENDING").reduce((a, p) => a + p.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <PageHeader icon={Wallet} title={t("title")} description={t("subtitle")} />

      {returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <span>{t("returnHint")}</span>
          <Button asChild size="sm" variant="outline">
            <Link href={returnTo}>{t("backToPurchase")}</Link>
          </Button>
        </div>
      )}

      {data === null && !error ? (
        <StatGridSkeleton count={2} className="lg:grid-cols-2" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <StatCard label={t("balance")} value={money(data?.balance ?? 0)} icon={Wallet} tone="success" />
          <StatCard label={t("pendingTopups")} value={money(pending)} icon={History} tone="warning" hint={t("pendingHint")} />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t("loadError")}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <SectionCard icon={Ticket} title={t("redeemTitle")} description={t("redeemDescription")} className="lg:col-span-2">
          <RedeemCodeForm navigate={false} onRedeemed={load} />
        </SectionCard>

        <div ref={topupRef} className="scroll-mt-24 lg:col-span-3">
          <SectionCard icon={Landmark} title={t("topupTitle")} description={t("topupDescription")}>
            {data ? <TopupForm receiving={data.receiving} onSubmitted={load} /> : <TableSkeleton rows={3} />}
          </SectionCard>
        </div>
      </div>

      <SectionCard icon={ReceiptText} title={t("requestsTitle")} contentClassName="p-0">
        {data === null ? (
          <TableSkeleton rows={3} />
        ) : data.payments.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={ReceiptText} title={t("noRequests")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("method")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("reference")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateFmt.format(new Date(p.createdAt))}</TableCell>
                    <TableCell className="whitespace-nowrap">{methodLabel(p.method)}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{money(p.amount)}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {p.reference}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} label={t(`requestStatus.${p.status}`)} />
                      {p.status === "REJECTED" && p.reviewNote && (
                        <p className="mt-1 max-w-[16rem] text-xs text-muted-foreground">{p.reviewNote}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={History} title={t("transactionsTitle")} contentClassName="p-0">
        {data === null ? (
          <TableSkeleton rows={4} />
        ) : data.transactions.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={History} title={t("noTransactions")} description={t("noTransactionsHint")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("balanceAfter")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{dateFmt.format(new Date(tx.createdAt))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tx.type === "CREDIT" ? (
                          <ArrowDownLeft className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm">{reasonLabel(tx.reason)}</p>
                          {tx.note && <p className="truncate text-xs text-muted-foreground">{tx.note}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap font-medium", tx.type === "CREDIT" ? "text-success" : "text-destructive")}>
                      <span dir="ltr">
                        {tx.type === "CREDIT" ? "+" : "−"}
                        {nf.format(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{money(tx.balanceAfter)}</TableCell>
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
