"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Ban, Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Approve / suspend / reactivate buttons for one organization row. */
export function AdminOrgActions({ orgId, isApproved, isActive }: { orgId: string; isApproved: boolean; isActive: boolean }) {
  const t = useTranslations("organizations")
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  const patch = async (data: Record<string, boolean>, ok: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success(ok)
      router.refresh()
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!isApproved && (
        <Button size="sm" className="gap-1" disabled={busy} onClick={() => patch({ isApproved: true }, t("admin.approved"))}>
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("admin.approve")}
        </Button>
      )}
      {isActive ? (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-destructive"
          disabled={busy}
          onClick={() => confirm(t("admin.suspendConfirm")) && patch({ isActive: false }, t("admin.suspended"))}
        >
          <Ban className="h-4 w-4" aria-hidden="true" />
          {t("admin.suspend")}
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => patch({ isActive: true }, t("admin.reactivated"))}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("admin.reactivate")}
        </Button>
      )}
    </div>
  )
}
