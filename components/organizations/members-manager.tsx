"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AvatarName, EmptyState, SectionCard } from "@/components/shared"

type OrgRole = "OWNER" | "MANAGER" | "TEACHER" | "STUDENT"

export interface MemberRow {
  id: string
  role: OrgRole
  joinedAt: string
  user: { id: string; name: string | null; email: string; image: string | null; role: string }
}

export function MembersManager({
  orgId,
  members,
  viewerRole,
  viewerId,
  prefillEmail,
}: {
  orgId: string
  members: MemberRow[]
  viewerRole: OrgRole
  viewerId: string
  prefillEmail?: string
}) {
  const t = useTranslations("organizations")
  const locale = useLocale()
  const router = useRouter()
  const [filter, setFilter] = React.useState<"ALL" | OrgRole>("ALL")
  const [email, setEmail] = React.useState(prefillEmail ?? "")
  const [busy, setBusy] = React.useState<string | null>(null)
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const isOwner = viewerRole === "OWNER"

  const call = async (key: string, url: string, init: RequestInit, ok: string) => {
    setBusy(key)
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic"))
        return false
      }
      toast.success(ok)
      router.refresh()
      return true
    } catch {
      toast.error(t("errors.generic"))
      return false
    } finally {
      setBusy(null)
    }
  }

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    const ok = await call("add", `/api/organizations/${orgId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), role: "STUDENT" }),
    }, t("members.added"))
    if (ok) setEmail("")
  }

  const rows = filter === "ALL" ? members : members.filter((m) => m.role === filter)
  const roleOptions = (m: MemberRow): OrgRole[] =>
    m.user.role === "STUDENT" ? ["STUDENT"] : isOwner ? ["MANAGER", "TEACHER"] : ["TEACHER"]

  return (
    <div className="space-y-6">
      <SectionCard icon={UserPlus} title={t("members.addStudent")} description={t("members.addStudentHint")}>
        <form onSubmit={addStudent} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="add-email">{t("members.email")}</Label>
            <Input id="add-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy === "add"} className="gap-2">
            {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("members.add")}
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title={t("members.title")}
        action={
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-9 w-36" aria-label={t("members.filter")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("members.all")}</SelectItem>
              {(["OWNER", "MANAGER", "TEACHER", "STUDENT"] as const).map((r) => (
                <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {rows.length === 0 ? (
          <EmptyState variant="plain" size="sm" title={t("members.empty")} />
        ) : (
          <ul className="divide-y">
            {rows.map((m) => {
              const locked = m.role === "OWNER" || (m.role === "MANAGER" && !isOwner)
              const options = roleOptions(m)
              return (
                <li key={m.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <AvatarName
                    className="min-w-0 flex-1"
                    name={m.user.name || m.user.email}
                    image={m.user.image}
                    secondary={<span dir="ltr">{m.user.email}</span>}
                  />
                  <span className="text-xs text-muted-foreground">{t("members.joined", { date: df.format(new Date(m.joinedAt)) })}</span>
                  <div className="flex items-center gap-2">
                    {locked || options.length < 2 ? (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{t(`roles.${m.role}`)}</span>
                    ) : (
                      <Select
                        value={m.role}
                        disabled={busy === m.id}
                        onValueChange={(role) =>
                          call(m.id, `/api/organizations/${orgId}/members/${m.id}`, { method: "PATCH", body: JSON.stringify({ role }) }, t("members.roleChanged"))
                        }
                      >
                        <SelectTrigger className="h-8 w-32" aria-label={t("members.role")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {options.map((r) => (
                            <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!locked && m.user.id !== viewerId && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        aria-label={t("members.remove")}
                        disabled={busy === m.id}
                        onClick={() => {
                          if (confirm(t("members.removeConfirm", { name: m.user.name || m.user.email }))) {
                            call(m.id, `/api/organizations/${orgId}/members/${m.id}`, { method: "DELETE" }, t("members.removed"))
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
