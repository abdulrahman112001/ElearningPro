"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Banknote,
  BellRing,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FilePlus2,
  Loader2,
  Printer,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AvatarName,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/shared"
import { FeeBadge, GroupTabs } from "@/components/attendance/group-tabs"
import { cairoFormatters, currentPeriod, fetchJson, formatPeriod, shiftPeriod } from "@/components/attendance/time"

interface Fee {
  id: string
  studentId: string
  period: string
  amount: number
  status: "DUE" | "PAID" | "WAIVED"
  method: string | null
  paidAt: string | null
  receiptNo: string | null
  note: string | null
  student: { id: string; name: string | null; email: string | null; image: string | null }
  recordedBy: { id: string; name: string | null } | null
}

interface FeesData {
  group: { id: string; name: string; monthlyFee: number }
  period: string
  fees: Fee[]
  summary: { due: number; collected: number; outstanding: number; waived: number; paidCount: number; dueCount: number; count: number }
  missing: number
  outstandingAllTime: { amount: number; count: number }
  canUndo: boolean
  nextReminderAt: string | null
}

type Action = { kind: "pay" | "waive" | "undo"; fee: Fee }

function FeesInner() {
  const groupId = useParams<{ groupId: string }>()?.groupId ?? ""
  const search = useSearchParams()
  const router = useRouter()
  const t = useTranslations("fees")
  const tg = useTranslations("attendance")
  const tc = useTranslations("common")
  const locale = useLocale()
  const fmt = cairoFormatters(locale)
  const period = (search?.get("period") && /^\d{4}-\d{2}$/.test(search.get("period")!) ? search.get("period")! : null) ?? currentPeriod()
  const money = (v: number) => t("money", { amount: fmt.money.format(v) })

  const [data, setData] = React.useState<FeesData | null>(null)
  const [forbidden, setForbidden] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [reminding, setReminding] = React.useState(false)
  const [action, setAction] = React.useState<Action | null>(null)
  const [note, setNote] = React.useState("")
  const [working, setWorking] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      setData(await fetchJson<FeesData>(`/api/instructor/groups/${groupId}/fees?period=${period}`))
    } catch {
      setForbidden(true)
    }
  }, [groupId, period])

  React.useEffect(() => {
    if (!groupId) return
    setData(null)
    load()
  }, [groupId, load])

  const goTo = (p: string) => router.replace(`/instructor/groups/${groupId}/fees?period=${p}`)

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetchJson<{ created: number }>(`/api/instructor/groups/${groupId}/fees/generate`, {
        method: "POST",
        json: { period },
      })
      toast.success(t("generated", { count: res.created }))
      await load()
    } catch (err: any) {
      toast.error(err?.code === "no_monthly_fee" ? t("noMonthlyFee") : t("actionFailed"))
    } finally {
      setGenerating(false)
    }
  }

  const remind = async () => {
    setReminding(true)
    try {
      const res = await fetchJson<{ students: number; messages: number }>(`/api/instructor/groups/${groupId}/fees/remind`, {
        method: "POST",
      })
      toast.success(t("remindersSent", { students: res.students, messages: res.messages }))
      await load()
    } catch (err: any) {
      toast.error(err?.code === "rate_limited" ? t("remindersLimited") : t("actionFailed"))
    } finally {
      setReminding(false)
    }
  }

  const runAction = async () => {
    if (!action) return
    if (action.kind === "waive" && !note.trim()) {
      toast.error(t("noteRequired"))
      return
    }
    setWorking(true)
    try {
      const res = await fetchJson<Fee>(`/api/instructor/groups/${groupId}/fees/${action.fee.id}/${action.kind}`, {
        method: "POST",
        json: action.kind === "undo" ? {} : { note: note.trim() || null },
      })
      if (action.kind === "pay") {
        toast.success(t("paidToast", { receipt: res.receiptNo ?? "" }))
      } else {
        toast.success(action.kind === "waive" ? t("waivedToast") : t("undoneToast"))
      }
      setAction(null)
      await load()
      if (action.kind === "pay") window.open(`/instructor/groups/${groupId}/fees/${action.fee.id}/receipt`, "_blank")
    } catch (err: any) {
      toast.error(err?.status === 403 ? t("undoForbidden") : t("actionFailed"))
    } finally {
      setWorking(false)
    }
  }

  if (forbidden) {
    return (
      <EmptyState
        icon={Wallet}
        title={tg("notFound")}
        action={
          <Button asChild variant="outline">
            <Link href="/instructor/groups">{tg("backToGroups")}</Link>
          </Button>
        }
      />
    )
  }

  const Prev = locale === "ar" ? ChevronRight : ChevronLeft
  const Next = locale === "ar" ? ChevronLeft : ChevronRight
  const remindLocked = !!data?.nextReminderAt && new Date(data.nextReminderAt).getTime() > Date.now()

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title={t("title")}
        description={data ? t("subtitle", { name: data.group.name }) : undefined}
        breadcrumbs={[
          { label: tg("groupsCrumb"), href: "/instructor/groups" },
          { label: data?.group.name ?? "…", href: `/instructor/groups/${groupId}` },
          { label: t("title") },
        ]}
      />
      <GroupTabs groupId={groupId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("prevMonth")} onClick={() => goTo(shiftPeriod(period, -1))}>
            <Prev className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] text-center text-sm font-semibold">{formatPeriod(period, locale)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("nextMonth")} onClick={() => goTo(shiftPeriod(period, 1))}>
            <Next className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={generating || !data || data.group.monthlyFee <= 0} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
            {t("generate")}
          </Button>
          <Button
            variant="outline"
            onClick={remind}
            disabled={reminding || !data || remindLocked || data.outstandingAllTime.count === 0}
            className="gap-2"
            title={remindLocked && data?.nextReminderAt ? t("remindAfter", { date: fmt.dateTime.format(new Date(data.nextReminderAt)) }) : undefined}
          >
            {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            {t("sendReminders")}
          </Button>
        </div>
      </div>

      {data && data.group.monthlyFee <= 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {t("noMonthlyFee")}{" "}
          <Link href={`/instructor/groups/${groupId}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("openSettings")}
          </Link>
        </p>
      )}
      {data && data.missing > 0 && data.group.monthlyFee > 0 && (
        <p className="text-sm text-muted-foreground">{t("missingHint", { count: data.missing, amount: fmt.money.format(data.group.monthlyFee) })}</p>
      )}

      {data === null ? (
        <StatGridSkeleton count={4} className="lg:grid-cols-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label={t("statDue")} value={money(data.summary.due)} icon={CircleDollarSign} tone="info" hint={t("feesCount", { count: data.summary.count })} />
          <StatCard label={t("statCollected")} value={money(data.summary.collected)} icon={Banknote} tone="success" hint={t("paidCount", { count: data.summary.paidCount })} />
          <StatCard label={t("statOutstanding")} value={money(data.summary.outstanding)} icon={Wallet} tone="warning" hint={t("dueCount", { count: data.summary.dueCount })} />
          <StatCard
            label={t("statOutstandingAll")}
            value={money(data.outstandingAllTime.amount)}
            icon={Receipt}
            tone="danger"
            hint={t("dueCount", { count: data.outstandingAllTime.count })}
          />
        </div>
      )}

      <SectionCard icon={Receipt} title={t("tableTitle", { month: formatPeriod(period, locale) })} contentClassName="p-0">
        {data === null ? (
          <div className="p-4">
            <TableSkeleton rows={4} />
          </div>
        ) : data.fees.length === 0 ? (
          <EmptyState variant="plain" icon={Receipt} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="ps-4 sm:ps-6">{t("student")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("details")}</TableHead>
                <TableHead className="pe-4 text-end sm:pe-6">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.fees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="ps-4 sm:ps-6">
                    <AvatarName
                      name={f.student.name}
                      image={f.student.image}
                      size="sm"
                      secondary={<FeeBadge status={f.status} />}
                      className="max-w-[11rem] sm:max-w-xs"
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{money(f.amount)}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                    {f.status === "PAID" && (
                      <span>
                        {t(`methods.${f.method ?? "CASH"}`)} · <span dir="ltr">{f.receiptNo}</span>
                        {f.paidAt ? ` · ${fmt.date.format(new Date(f.paidAt))}` : ""}
                      </span>
                    )}
                    {f.status === "WAIVED" && <span>{f.note}</span>}
                  </TableCell>
                  <TableCell className="pe-4 sm:pe-6">
                    <div className="flex flex-wrap justify-end gap-1">
                      {f.status === "DUE" && (
                        <>
                          <Button size="sm" className="h-8 gap-1" onClick={() => { setNote(""); setAction({ kind: "pay", fee: f }) }}>
                            <Banknote className="h-3.5 w-3.5" />
                            {t("recordCash")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => { setNote(""); setAction({ kind: "waive", fee: f }) }}>
                            {t("waive")}
                          </Button>
                        </>
                      )}
                      {f.status === "PAID" && (
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                          <Link href={`/instructor/groups/${groupId}/fees/${f.id}/receipt`} target="_blank">
                            <Printer className="h-3.5 w-3.5" />
                            {t("receipt")}
                          </Link>
                        </Button>
                      )}
                      {f.status !== "DUE" && data.canUndo && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          aria-label={t("undo")}
                          onClick={() => setAction({ kind: "undo", fee: f })}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <Dialog open={!!action} onOpenChange={(o) => !working && !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action ? t(`${action.kind}Title`) : ""}</DialogTitle>
            <DialogDescription>
              {action
                ? t(`${action.kind}Description`, {
                    name: action.fee.student.name ?? "",
                    amount: fmt.money.format(action.fee.amount),
                    month: formatPeriod(action.fee.period, locale),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {action && action.kind !== "undo" && (
            <div className="space-y-2">
              <Label htmlFor="fee-note">{action.kind === "waive" ? t("waiveNote") : t("payNote")}</Label>
              <Textarea id="fee-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAction(null)} disabled={working}>
              {tc("cancel")}
            </Button>
            <Button onClick={runAction} disabled={working} className="gap-2">
              {working && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function GroupFeesPage() {
  return (
    <React.Suspense fallback={<TableSkeleton rows={4} />}>
      <FeesInner />
    </React.Suspense>
  )
}
