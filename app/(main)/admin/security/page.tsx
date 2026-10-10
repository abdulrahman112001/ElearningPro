"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Loader2,
  MonitorSmartphone,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserSearch,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  AvatarName,
  CardSkeleton,
  EmptyState,
  ListSkeleton,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/shared"
import { cn } from "@/lib/utils"

interface Settings {
  maxDevices: number
  defaultMaxViews: number | null
  stats: { activeDevices: number; usersWithDevices: number }
}

interface FoundUser {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  image: string | null
  role: string
  activeDevices: number
}

interface Device {
  id: string
  label: string | null
  userAgent: string | null
  ip: string | null
  firstSeenAt: string
  lastSeenAt: string
  revokedAt: string | null
}

interface DevicesData {
  user: { id: string; name: string | null; email: string | null; phone: string | null; image: string | null }
  devices: Device[]
  activeCount: number
  maxDevices: number
}

export default function AdminSecurityPage() {
  const t = useTranslations("videoProtection")
  const locale = useLocale()
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  // ---- Settings ----
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [maxDevices, setMaxDevices] = React.useState("")
  const [defaultMaxViews, setDefaultMaxViews] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const loadSettings = React.useCallback(() => {
    fetch("/api/admin/security")
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((s: Settings) => {
        setSettings(s)
        setMaxDevices(String(s.maxDevices))
        setDefaultMaxViews(s.defaultMaxViews == null ? "" : String(s.defaultMaxViews))
      })
      .catch(() => toast.error(t("loadFailed")))
  }, [t])

  React.useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const devicesNum = Number(maxDevices)
  const devicesInvalid =
    maxDevices.trim() === "" || !Number.isInteger(devicesNum) || devicesNum < 0 || devicesNum > 20
  const viewsNum = Number(defaultMaxViews)
  const viewsInvalid =
    defaultMaxViews.trim() !== "" && (!Number.isInteger(viewsNum) || viewsNum < 1 || viewsNum > 100)
  const dirty =
    !!settings &&
    (devicesNum !== settings.maxDevices ||
      (defaultMaxViews.trim() === "" ? null : viewsNum) !== settings.defaultMaxViews)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (devicesInvalid || viewsInvalid) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDevices: devicesNum,
          defaultMaxViews: defaultMaxViews.trim() === "" ? null : viewsNum,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("settingsSaved"))
      loadSettings()
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  // ---- User search ----
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<FoundUser[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [selected, setSelected] = React.useState<DevicesData | null>(null)
  const [loadingDevices, setLoadingDevices] = React.useState(false)
  const [confirm, setConfirm] = React.useState<{ deviceId: string | null } | null>(null)
  const [resetting, setResetting] = React.useState(false)

  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    setSearching(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/admin/security/users?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d) => setResults(d.users))
        .catch(() => {})
        .finally(() => setSearching(false))
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query])

  const openUser = async (userId: string) => {
    setLoadingDevices(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/devices`)
      if (!res.ok) throw new Error()
      setSelected(await res.json())
    } catch {
      toast.error(t("loadFailed"))
    } finally {
      setLoadingDevices(false)
    }
  }

  const reset = async () => {
    if (!selected || !confirm) return
    setResetting(true)
    try {
      const qs = confirm.deviceId ? `?deviceId=${encodeURIComponent(confirm.deviceId)}` : ""
      const res = await fetch(`/api/admin/users/${selected.user.id}/devices${qs}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(confirm.deviceId ? t("deviceRemoved") : t("devicesResetDone"))
      setConfirm(null)
      await openUser(selected.user.id)
      setResults((r) =>
        r?.map((u) =>
          u.id === selected.user.id
            ? { ...u, activeDevices: confirm.deviceId ? Math.max(0, u.activeDevices - 1) : 0 }
            : u
        ) ?? null
      )
      loadSettings()
    } catch {
      toast.error(t("saveFailed"))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title={t("adminTitle")} description={t("adminSubtitle")} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label={t("statActiveDevices")}
          value={settings ? nf.format(settings.stats.activeDevices) : "—"}
          icon={MonitorSmartphone}
          tone="info"
        />
        <StatCard
          label={t("statUsersWithDevices")}
          value={settings ? nf.format(settings.stats.usersWithDevices) : "—"}
          icon={Smartphone}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          icon={ShieldCheck}
          title={t("settingsTitle")}
          description={t("settingsHint")}
          className="lg:col-span-1 lg:self-start"
        >
          {settings === null ? (
            <CardSkeleton withImage={false} className="border-0 shadow-none" />
          ) : (
            <form onSubmit={save} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="max-devices">{t("maxDevicesLabel")}</Label>
                <Input
                  id="max-devices"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  step={1}
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(e.target.value)}
                  aria-invalid={devicesInvalid}
                  disabled={saving}
                  className="tabular-nums"
                />
                <p className={cn("text-xs", devicesInvalid ? "text-destructive" : "text-muted-foreground")}>
                  {devicesInvalid ? t("maxDevicesInvalid") : t("maxDevicesHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-max-views">{t("defaultMaxViewsLabel")}</Label>
                <Input
                  id="default-max-views"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={defaultMaxViews}
                  onChange={(e) => setDefaultMaxViews(e.target.value)}
                  placeholder={t("maxViewsPlaceholder")}
                  aria-invalid={viewsInvalid}
                  disabled={saving}
                  className="tabular-nums"
                />
                <p className={cn("text-xs", viewsInvalid ? "text-destructive" : "text-muted-foreground")}>
                  {viewsInvalid ? t("maxViewsInvalid") : t("defaultMaxViewsHint")}
                </p>
              </div>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={saving || !dirty || devicesInvalid || viewsInvalid}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("save")}
              </Button>
            </form>
          )}
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard icon={UserSearch} title={t("userDevicesTitle")} description={t("userDevicesHint")}>
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="ps-9"
                  aria-label={t("searchPlaceholder")}
                />
                {searching && (
                  <Loader2 className="absolute inset-y-0 end-3 my-auto h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {results !== null &&
                (results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noUsersFound")}</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {results.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => openUser(u.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors hover:bg-muted/50",
                            selected?.user.id === u.id && "bg-primary/5"
                          )}
                        >
                          <AvatarName
                            size="sm"
                            name={u.name}
                            image={u.image}
                            secondary={<span dir="ltr">{u.phone || u.email}</span>}
                            className="min-w-0"
                          />
                          <Badge variant={u.activeDevices > 0 ? "secondary" : "outline"} className="shrink-0">
                            {t("devicesCount", { count: u.activeDevices })}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </SectionCard>

          {loadingDevices && !selected ? (
            <ListSkeleton />
          ) : selected ? (
            <SectionCard
              icon={MonitorSmartphone}
              title={selected.user.name || selected.user.email}
              description={
                selected.maxDevices > 0
                  ? t("devicesUsage", { used: nf.format(selected.activeCount), max: nf.format(selected.maxDevices) })
                  : t("devicesUnlimited")
              }
              action={
                selected.activeCount > 0 ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    onClick={() => setConfirm({ deviceId: null })}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t("resetAll")}
                  </Button>
                ) : undefined
              }
              contentClassName="p-0"
            >
              {selected.devices.length === 0 ? (
                <EmptyState variant="plain" icon={MonitorSmartphone} title={t("noDevices")} />
              ) : (
                <ul className="divide-y">
                  {selected.devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium" dir="ltr">
                            {d.label || t("unknownDevice")}
                          </span>
                          {d.revokedAt && <Badge variant="outline">{t("revoked")}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("lastSeen", { date: dateFmt.format(new Date(d.lastSeenAt)) })}
                          {d.ip && (
                            <>
                              <span className="mx-1">·</span>
                              <span dir="ltr">{d.ip}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {!d.revokedAt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setConfirm({ deviceId: d.id })}
                          aria-label={t("removeDevice")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : null}
        </div>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.deviceId ? t("removeDevice") : t("resetAll")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resetConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                reset()
              }}
              disabled={resetting}
            >
              {resetting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
