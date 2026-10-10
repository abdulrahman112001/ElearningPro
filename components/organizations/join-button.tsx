"use client"

import * as React from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * "Join" call to action on the public page. Guests are sent to log in;
 * students send a join request that notifies the organization's managers.
 */
export function JoinButton({
  orgId,
  slug,
  viewer,
}: {
  orgId: string
  slug: string
  viewer: "guest" | "student" | "member" | "other"
}) {
  const t = useTranslations("organizations")
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const style = { backgroundColor: "var(--org-primary)", color: "#fff" }

  if (viewer === "guest") {
    return (
      <Button asChild size="lg" style={style} className="gap-2 hover:opacity-90">
        <Link href={`/login?callbackUrl=${encodeURIComponent(`/o/${slug}`)}`}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("public.join")}
        </Link>
      </Button>
    )
  }
  if (viewer === "member") {
    return (
      <Button asChild size="lg" variant="secondary">
        <Link href={`/org/${orgId}`}>{t("public.openDashboard")}</Link>
      </Button>
    )
  }
  if (viewer === "other") {
    return <p className="text-sm opacity-90">{t("public.studentsOnly")}</p>
  }

  const send = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        toast.error(t("public.alreadyRequested"))
        setSent(true)
        return
      }
      if (!res.ok) {
        toast.error(data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic"))
        return
      }
      setSent(true)
      toast.success(t("public.requestSent"))
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="lg" style={style} className="gap-2 hover:opacity-90" disabled={busy || sent} onClick={send}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
      {sent ? t("public.requestSentShort") : t("public.join")}
    </Button>
  )
}
