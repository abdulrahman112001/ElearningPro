"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { CreditCard, Crown, Loader2, Save, Settings2, UserCheck, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AvatarName,
  CardSkeleton,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGridSkeleton,
  StatusBadge,
  TableSkeleton,
} from "@/components/shared"
import { formatPrice } from "@/lib/utils"

interface Settings {
  enabled: boolean
  monthlyPrice: number
  activeSubscribers: number
}

interface SubscriptionRow {
  id: string
  status: string
  startsAt: string | null
  endsAt: string | null
  amount: number
  currency: string
  instructorShare: number
  student: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    gradeLevel: { id: string; nameAr: string; nameEn: string } | null
  }
}

interface SubscribersData {
  subscriptions: SubscriptionRow[]
  stats: { active: number; total: number; revenue: number }
}

export default function InstructorSubscribersPage() {
  const t = useTranslations("teacherSubscription")
  const locale = useLocale()
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [enabled, setEnabled] = React.useState(false)
  const [price, setPrice] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [data, setData] = React.useState<SubscribersData | null>(null)
  const [error, setError] = React.useState(false)

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const money = (v: number, currency = "EGP") =>
    v === 0 ? nf.format(0) : formatPrice(v, currency, locale)
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—")

  React.useEffect(() => {
    fetch("/api/instructor/subscription")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((s: Settings) => {
        setSettings(s)
        setEnabled(s.enabled)
        setPrice(String(s.monthlyPrice ?? 0))
      })
      .catch(() => setSettings({ enabled: false, monthlyPrice: 0, activeSubscribers: 0 }))
    fetch("/api/instructor/subscribers")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setData)
      .catch(() => {
        setError(true)
        setData({ subscriptions: [], stats: { active: 0, total: 0, revenue: 0 } })
      })
  }, [])

  const priceNumber = Number(price)
  const priceInvalid = price.trim() === "" || !Number.isFinite(priceNumber) || priceNumber < 0 || priceNumber > 100000
  const enableWithoutPrice = enabled && !priceInvalid && priceNumber === 0
  const dirty = !!settings && (enabled !== settings.enabled || priceNumber !== settings.monthlyPrice)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (priceInvalid) {
      toast.error(t("priceInvalid"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/instructor/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, monthlyPrice: priceNumber }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSettings((s) => ({
        activeSubscribers: s?.activeSubscribers ?? 0,
        enabled: updated.enabled,
        monthlyPrice: updated.monthlyPrice,
      }))
      toast.success(t("saved"))
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Crown} title={t("title")} description={t("subtitle")} />

      {data === null ? (
        <StatGridSkeleton count={3} className="lg:grid-cols-3" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard label={t("statActive")} value={nf.format(data.stats.active)} icon={UserCheck} tone="success" />
          <StatCard label={t("statTotal")} value={nf.format(data.stats.total)} icon={Users} tone="info" />
          <StatCard
            label={t("statRevenue")}
            value={money(data.stats.revenue)}
            icon={Wallet}
            hint={t("statRevenueHint")}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          icon={Settings2}
          title={t("settingsTitle")}
          description={t("settingsHint")}
          className="lg:col-span-1 lg:self-start"
        >
          {settings === null ? (
            <CardSkeleton withImage={false} className="border-0 shadow-none" />
          ) : (
            <form onSubmit={save} className="space-y-5">
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="sub-enabled" className="font-medium">
                    {t("enableLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("enableHint")}</p>
                </div>
                <Switch id="sub-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-price">{t("priceLabel")}</Label>
                <div className="relative">
                  <Input
                    id="sub-price"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100000}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={saving}
                    className="pe-14 tabular-nums"
                    aria-invalid={priceInvalid}
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
                    {t("currency")}
                  </span>
                </div>
                <p
                  className={
                    priceInvalid
                      ? "text-xs text-destructive"
                      : enableWithoutPrice
                        ? "text-xs text-amber-700 dark:text-amber-400"
                        : "text-xs text-muted-foreground"
                  }
                >
                  {priceInvalid ? t("priceInvalid") : enableWithoutPrice ? t("freeSubscriptionWarning") : t("priceHint")}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t("currentStatus")}</span>
                <StatusBadge status={settings.enabled ? "ACTIVE" : "INACTIVE"} />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={saving || !dirty}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("save")}
              </Button>
            </form>
          )}
        </SectionCard>

        <div className="lg:col-span-2">
          {data === null ? (
            <TableSkeleton rows={5} columns={5} />
          ) : (
            <SectionCard
              icon={CreditCard}
              title={t("subscribersTitle")}
              description={t("subscribersHint")}
              contentClassName="p-0"
            >
              {data.subscriptions.length === 0 ? (
                <EmptyState
                  variant="plain"
                  icon={Users}
                  title={error ? t("loadFailed") : t("emptyTitle")}
                  description={error ? undefined : t("emptyHint")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="ps-4 sm:ps-6">{t("student")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("grade")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("period")}</TableHead>
                      <TableHead className="pe-4 text-end sm:pe-6">{t("amount")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.subscriptions.map((s) => {
                      const lapsed = s.status === "ACTIVE" && s.endsAt && new Date(s.endsAt) <= new Date()
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="ps-4 sm:ps-6">
                            <AvatarName
                              size="sm"
                              name={s.student.name}
                              image={s.student.image}
                              secondary={<span dir="ltr">{s.student.email}</span>}
                              className="max-w-[10rem] sm:max-w-[14rem]"
                            />
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {s.student.gradeLevel
                              ? locale === "ar"
                                ? s.student.gradeLevel.nameAr || s.student.gradeLevel.nameEn
                                : s.student.gradeLevel.nameEn || s.student.gradeLevel.nameAr
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={lapsed ? "EXPIRED" : s.status} />
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground sm:table-cell">
                            <div>{fmtDate(s.startsAt)}</div>
                            <div>{t("until", { date: fmtDate(s.endsAt) })}</div>
                          </TableCell>
                          <TableCell className="pe-4 text-end sm:pe-6">
                            <div className="font-semibold tabular-nums">{money(s.amount, s.currency)}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {t("yourShare", { amount: money(s.instructorShare, s.currency) })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}
