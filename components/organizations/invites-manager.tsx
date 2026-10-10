"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Copy, Loader2, Mail, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, SectionCard, StatusBadge } from "@/components/shared"

export interface InviteRow {
  id: string
  email: string
  role: "MANAGER" | "TEACHER" | "STUDENT" | "OWNER"
  token: string
  expiresAt: string
  createdAt: string
}

export function InvitesManager({
  orgId,
  invites,
  canInviteManagers,
}: {
  orgId: string
  invites: InviteRow[]
  canInviteManagers: boolean
}) {
  const t = useTranslations("organizations")
  const locale = useLocale()
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"MANAGER" | "TEACHER" | "STUDENT">("STUDENT")
  const [busy, setBusy] = React.useState<string | null>(null)
  const df = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const now = Date.now()

  const link = (token: string) => `${window.location.origin}/org/invite/${token}`

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy("send")
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic"))
        return
      }
      toast.success(data.emailSent ? t("invites.sent") : t("invites.sentNoEmail"))
      setEmail("")
      router.refresh()
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(t("invites.revoked"))
      router.refresh()
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard icon={Send} title={t("invites.new")} description={t("invites.newHint")}>
        <form onSubmit={send} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">{t("members.email")}</Label>
            <Input id="invite-email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">{t("members.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="invite-role" className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">{t("roles.STUDENT")}</SelectItem>
                <SelectItem value="TEACHER">{t("roles.TEACHER")}</SelectItem>
                {canInviteManagers && <SelectItem value="MANAGER">{t("roles.MANAGER")}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy === "send"} className="gap-2">
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
            {t("invites.send")}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title={t("invites.pending")}>
        {invites.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={Mail} title={t("invites.empty")} />
        ) : (
          <ul className="divide-y">
            {invites.map((inv) => {
              const expired = new Date(inv.expiresAt).getTime() <= now
              return (
                <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="ltr">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`roles.${inv.role}`)} · {t("invites.expires", { date: df.format(new Date(inv.expiresAt)) })}
                    </p>
                  </div>
                  <StatusBadge status={expired ? "EXPIRED" : "PENDING"} label={expired ? t("invites.expired") : t("invites.waiting")} />
                  <div className="flex gap-1">
                    {!expired && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(link(inv.token))
                            toast.success(t("invites.copied"))
                          } catch {
                            toast.error(t("errors.generic"))
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        {t("invites.copy")}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" disabled={busy === inv.id} onClick={() => revoke(inv.id)}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      {t("invites.revoke")}
                    </Button>
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
