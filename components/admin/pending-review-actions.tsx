"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"

interface PendingReviewActionsProps {
  kind: "course" | "instructor"
  id: string
}

/** Approve / reject buttons for the admin dashboard's pending-review lists. */
export function PendingReviewActions({ kind, id }: PendingReviewActionsProps) {
  const t = useTranslations("admin")
  const router = useRouter()
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null)

  const run = async (decision: "approve" | "reject") => {
    setBusy(decision)
    try {
      const url = kind === "course" ? `/api/admin/courses/${id}` : `/api/admin/instructors/${id}`
      // The instructors API calls a rejection "revoke".
      const action = kind === "instructor" && decision === "reject" ? "revoke" : decision
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) throw new Error()
      toast.success(t("actionSuccess"))
      router.refresh()
    } catch {
      toast.error(t("failed"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="text-green-600"
        aria-label={t("approve")}
        disabled={busy !== null}
        onClick={() => run("approve")}
      >
        {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive"
        aria-label={t("reject")}
        disabled={busy !== null}
        onClick={() => run("reject")}
      >
        {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
      </Button>
    </>
  )
}
