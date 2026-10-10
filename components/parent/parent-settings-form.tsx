"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Mail, MessageCircle, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SectionCard } from "@/components/shared"

interface Values {
  name: string
  email: string
  phone: string
  preferredLanguage: "ar" | "en"
  whatsappReports: boolean
  emailReports: boolean
}

export function ParentSettingsForm({ initial }: { initial: Values }) {
  const t = useTranslations("parent.settings")
  const tc = useTranslations("common")
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setBusy(true)
    try {
      const { email: _email, ...payload } = values
      const res = await fetch("/api/parent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.field === "phone") setErrors({ phone: t("errors.phone") })
        else if (data.field === "name") setErrors({ name: t("errors.name") })
        else toast.error(t("errors.generic"))
        return
      }
      toast.success(t("saved"))
      router.refresh()
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <SectionCard title={t("profileTitle")} description={t("profileDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ps-name">{t("name")}</Label>
            <Input id="ps-name" value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ps-email">{t("email")}</Label>
            <Input id="ps-email" value={values.email} disabled dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ps-phone">{t("phone")}</Label>
            <Input
              id="ps-phone"
              type="tel"
              dir="ltr"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="01xxxxxxxxx"
              error={errors.phone}
            />
            <p className="text-xs text-muted-foreground">{t("phoneHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ps-lang">{t("language")}</Label>
            <Select value={values.preferredLanguage} onValueChange={(v) => set("preferredLanguage", v as "ar" | "en")}>
              <SelectTrigger id="ps-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">{tc("arabic")}</SelectItem>
                <SelectItem value="en">{tc("english")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("languageHelp")}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("reportsTitle")} description={t("reportsDescription")}>
        <div className="space-y-4">
          <ChannelRow
            id="ps-wa"
            icon={MessageCircle}
            label={t("whatsapp")}
            hint={values.phone ? t("whatsappHelp") : t("whatsappNoPhone")}
            checked={values.whatsappReports}
            onChange={(v) => set("whatsappReports", v)}
          />
          <ChannelRow
            id="ps-email-reports"
            icon={Mail}
            label={t("emailReports")}
            hint={t("emailHelp")}
            checked={values.emailReports}
            onChange={(v) => set("emailReports", v)}
          />
        </div>
      </SectionCard>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        {tc("save")}
      </Button>
    </form>
  )
}

function ChannelRow({
  id,
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  icon: typeof Mail
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0">
          <Label htmlFor={id} className="font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
