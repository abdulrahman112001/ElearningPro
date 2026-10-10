"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations("organizations")
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const accept = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/invites/${encodeURIComponent(token)}`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.code ? t(`errors.${data.code}`) : data.error || t("errors.generic"))
        return
      }
      toast.success(t("acceptInvite.joined"))
      router.push(data.redirect || "/org")
      router.refresh()
    } catch {
      setError(t("errors.generic"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={accept} disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
        {t("acceptInvite.accept")}
      </Button>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
    </div>
  )
}
