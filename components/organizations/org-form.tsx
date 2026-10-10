"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SectionCard } from "@/components/shared"

export interface OrgFormValues {
  id?: string
  name: string
  type: "CENTER" | "SCHOOL" | "ACADEMY"
  slug: string
  description: string
  phone: string
  email: string
  address: string
  governorate: string
  logoUrl: string
  coverUrl: string
  primaryColor: string
}

const EMPTY: OrgFormValues = {
  name: "", type: "CENTER", slug: "", description: "", phone: "", email: "",
  address: "", governorate: "", logoUrl: "", coverUrl: "", primaryColor: "#4f46e5",
}

/** Create (no `initial.id`) or edit an organization's details and branding. */
export function OrgForm({ initial, canChangeType = true }: { initial?: OrgFormValues; canChangeType?: boolean }) {
  const t = useTranslations("organizations")
  const router = useRouter()
  const editing = !!initial?.id
  const [v, setV] = React.useState<OrgFormValues>(initial ?? EMPTY)
  const [slugTouched, setSlugTouched] = React.useState(editing)
  const [slugState, setSlugState] = React.useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const set = <K extends keyof OrgFormValues>(k: K, value: OrgFormValues[K]) => setV((p) => ({ ...p, [k]: value }))

  // Suggest a free slug from the name until the user edits it.
  React.useEffect(() => {
    if (slugTouched || v.name.trim().length < 2) return
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/organizations/slug?name=${encodeURIComponent(v.name)}`, { signal: ctrl.signal })
        if (res.ok) {
          const data = await res.json()
          setV((p) => ({ ...p, slug: data.slug }))
          setSlugState("ok")
        }
      } catch {}
    }, 400)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [v.name, slugTouched])

  // Check a hand-edited slug.
  React.useEffect(() => {
    if (!slugTouched || !v.slug) return
    setSlugState("checking")
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ slug: v.slug, ...(initial?.id ? { exclude: initial.id } : {}) })
        const res = await fetch(`/api/organizations/slug?${qs}`, { signal: ctrl.signal })
        if (res.ok) {
          const data = await res.json()
          setSlugState(!data.valid ? "invalid" : data.available ? "ok" : "taken")
        }
      } catch {}
    }, 400)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [v.slug, slugTouched, initial?.id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (v.name.trim().length < 2) {
      setError(t("form.nameRequired"))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name: v.name,
        slug: v.slug || undefined,
        description: v.description,
        phone: v.phone,
        email: v.email,
        address: v.address,
        governorate: v.governorate,
        logoUrl: v.logoUrl,
        coverUrl: v.coverUrl,
        primaryColor: v.primaryColor,
      }
      if (canChangeType) payload.type = v.type
      const res = await fetch(editing ? `/api/organizations/${initial!.id}` : "/api/organizations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.code === "slug_taken" ? t("form.slugTaken") : data.error || t("form.saveFailed"))
        return
      }
      toast.success(editing ? t("form.saved") : t("form.created"))
      if (editing) router.refresh()
      else router.push(`/org/${data.id}`)
    } catch {
      setError(t("form.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof OrgFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`org-${key}`}>{label}</Label>
      <Input id={`org-${key}`} value={v[key] ?? ""} onChange={(e) => set(key, e.target.value as never)} {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-6">
      <SectionCard title={t("form.basics")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("name", t("form.name"), { required: true, maxLength: 120 })}
          <div className="space-y-1.5">
            <Label htmlFor="org-type">{t("form.type")}</Label>
            <Select value={v.type} onValueChange={(x) => set("type", x as OrgFormValues["type"])} disabled={!canChangeType}>
              <SelectTrigger id="org-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["CENTER", "SCHOOL", "ACADEMY"] as const).map((x) => (
                  <SelectItem key={x} value={x}>{t(`types.${x}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-slug">{t("form.slug")}</Label>
            <div className="flex min-w-0 items-center gap-2" dir="ltr">
              <span className="shrink-0 text-sm text-muted-foreground">/o/</span>
              <Input
                id="org-slug"
                value={v.slug}
                maxLength={50}
                onChange={(e) => {
                  setSlugTouched(true)
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {slugState === "taken" ? t("form.slugTaken") : slugState === "invalid" ? t("form.slugInvalid") : t("form.slugHint")}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-description">{t("form.description")}</Label>
            <Textarea id="org-description" rows={4} maxLength={5000} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("form.contact")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("phone", t("form.phone"), { type: "tel", dir: "ltr", maxLength: 30 })}
          {field("email", t("form.email"), { type: "email", dir: "ltr", maxLength: 200 })}
          {field("governorate", t("form.governorate"), { maxLength: 60 })}
          {field("address", t("form.address"), { maxLength: 300 })}
        </div>
      </SectionCard>

      <SectionCard title={t("form.branding")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("logoUrl", t("form.logoUrl"), { type: "url", dir: "ltr", placeholder: "https://" })}
          {field("coverUrl", t("form.coverUrl"), { type: "url", dir: "ltr", placeholder: "https://" })}
          <div className="space-y-1.5">
            <Label htmlFor="org-color">{t("form.primaryColor")}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t("form.primaryColor")}
                value={/^#[0-9a-f]{6}$/i.test(v.primaryColor) ? v.primaryColor : "#4f46e5"}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-10 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input id="org-color" dir="ltr" maxLength={7} value={v.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
            </div>
          </div>
        </div>
      </SectionCard>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || slugState === "taken" || slugState === "invalid"} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {editing ? t("form.save") : t("form.create")}
        </Button>
      </div>
    </form>
  )
}
