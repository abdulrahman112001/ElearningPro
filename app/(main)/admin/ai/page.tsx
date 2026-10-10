"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Activity, CheckCircle2, Coins, Gauge, Loader2, Save, Sparkles, Users, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"

interface AdminAiData {
  configured: boolean
  model: string
  dailyLimit: number
  days: number
  usage: { day: string; feature: string; requests: number; inputTokens: number; outputTokens: number }[]
  features: Record<string, number>
  totals: { requests: number; inputTokens: number; outputTokens: number }
  topUsers: { requests: number; tokens: number; user: { id: string; name: string | null; email: string | null; image: string | null } }[]
}

const FEATURES = ["generate_questions", "tutor", "diagnose"] as const

export default function AdminAiPage() {
  const t = useTranslations("ai")
  const ta = useTranslations("admin")
  const locale = useLocale()
  const [data, setData] = React.useState<AdminAiData | null>(null)
  const [error, setError] = React.useState(false)
  const [limit, setLimit] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })

  const load = React.useCallback(() => {
    fetch("/api/ai/admin")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: AdminAiData) => {
        setData(d)
        setLimit(String(d.dailyLimit))
      })
      .catch(() => setError(true))
  }, [])
  React.useEffect(load, [load])

  const saveLimit = async () => {
    const value = Number(limit)
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      toast.error(t("limitInvalid"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/ai/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyLimit: value }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("limitSaved"))
      setData((d) => (d ? { ...d, dailyLimit: value } : d))
    } catch {
      toast.error(t("limitFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title={t("adminTitle")}
        description={t("adminDescription")}
        breadcrumbs={[{ label: ta("adminPanel"), href: "/admin" }, { label: t("adminTitle") }]}
      />

      {error ? (
        <EmptyState icon={XCircle} title={t("loadFailed")} />
      ) : !data ? (
        <>
          <StatGridSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("status")}
              value={data.configured ? t("enabled") : t("notEnabled")}
              icon={data.configured ? CheckCircle2 : XCircle}
              tone={data.configured ? "success" : "danger"}
              hint={data.configured ? data.model : t("keyMissingHint")}
            />
            <StatCard label={t("requests", { days: data.days })} value={nf.format(data.totals.requests)} icon={Activity} tone="info" />
            <StatCard
              label={t("tokens")}
              value={nf.format(data.totals.inputTokens + data.totals.outputTokens)}
              icon={Coins}
              tone="warning"
              hint={t("tokensSplit", { input: nf.format(data.totals.inputTokens), output: nf.format(data.totals.outputTokens) })}
            />
            <StatCard label={t("dailyLimit")} value={nf.format(data.dailyLimit)} icon={Gauge} tone="primary" hint={t("perUserPerDay")} />
          </div>

          <SectionCard icon={Gauge} title={t("dailyLimit")} description={t("dailyLimitDescription")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-48">
                <Label htmlFor="ai-limit">{t("requestsPerDay")}</Label>
                <Input id="ai-limit" type="number" min={0} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
              <Button type="button" onClick={saveLimit} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("save")}
              </Button>
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" icon={Activity} title={t("usageByDay")} contentClassName="p-0">
              {data.usage.length === 0 ? (
                <EmptyState icon={Activity} title={t("noUsage")} variant="plain" size="sm" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("day")}</TableHead>
                        <TableHead>{t("feature")}</TableHead>
                        <TableHead className="text-end">{t("requestsShort")}</TableHead>
                        <TableHead className="text-end">{t("tokens")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.usage.map((u) => (
                        <TableRow key={`${u.day}:${u.feature}`}>
                          <TableCell className="whitespace-nowrap">{df.format(new Date(`${u.day}T00:00:00Z`))}</TableCell>
                          <TableCell>
                            {(FEATURES as readonly string[]).includes(u.feature) ? t(`features.${u.feature}`) : u.feature}
                          </TableCell>
                          <TableCell className="text-end tabular-nums">{nf.format(u.requests)}</TableCell>
                          <TableCell className="text-end tabular-nums">{nf.format(u.inputTokens + u.outputTokens)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>

            <div className="space-y-6">
              <SectionCard icon={Sparkles} title={t("byFeature")}>
                <ul className="space-y-2 text-sm">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex items-center justify-between gap-2">
                      <span>{t(`features.${f}`)}</span>
                      <span className="font-semibold tabular-nums">{nf.format(data.features[f] ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
              <SectionCard icon={Users} title={t("topUsers")} contentClassName="p-0">
                {data.topUsers.length === 0 ? (
                  <EmptyState icon={Users} title={t("noUsage")} variant="plain" size="sm" />
                ) : (
                  <ul className="divide-y">
                    {data.topUsers.map((u) => (
                      <li key={u.user.id} className="flex items-center gap-3 px-4 py-3">
                        <AvatarName name={u.user.name} image={u.user.image} secondary={u.user.email} size="sm" className="min-w-0 flex-1" />
                        <span className={cn("shrink-0 text-sm font-semibold tabular-nums")}>{nf.format(u.requests)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
