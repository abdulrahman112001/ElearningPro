"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AdminAlertDialogProps {
  /** Student to alert; null closes the dialog */
  student: { id: string; name: string | null; email?: string | null } | null
  onOpenChange: (open: boolean) => void
}

const TITLE_MAX = 150
const MESSAGE_MAX = 3000

/** Admin sends an alert to a student (and optionally their guardian by email). */
export function AdminAlertDialog({ student, onOpenChange }: AdminAlertDialogProps) {
  const t = useTranslations("adminDashboard.alert")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [toGuardian, setToGuardian] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (student) {
      setTitle("")
      setMessage("")
      setToGuardian(false)
    }
  }, [student])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student) return
    if (!title.trim() || !message.trim()) {
      toast.error(t("required"))
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          title: title.trim(),
          message: message.trim(),
          toGuardian,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.code === "no_guardian_email") throw new Error(t("noGuardianEmail"))
        throw new Error(typeof data?.error === "string" ? data.error : t("failed"))
      }
      if (toGuardian && data?.emailDelivered === false) {
        toast(t("sentEmailFailed"), { icon: "⚠️" })
      } else {
        toast.success(toGuardian ? t("sentWithGuardian") : t("sent"))
      }
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("failed"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={!!student} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-amber-700 dark:text-amber-400">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle>{t("title", { name: student?.name || student?.email || "" })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="admin-alert-title">{t("fieldTitle")}</Label>
            <Input
              id="admin-alert-title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder={t("fieldTitlePlaceholder")}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="admin-alert-message">{t("fieldMessage")}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <Textarea
              id="admin-alert-message"
              value={message}
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder={t("fieldMessagePlaceholder")}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="admin-alert-guardian">{t("toGuardian")}</Label>
              <p className="text-xs text-muted-foreground">{t("toGuardianHint")}</p>
            </div>
            <Switch id="admin-alert-guardian" checked={toGuardian} onCheckedChange={setToGuardian} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <BellRing className="h-4 w-4" aria-hidden="true" />
              )}
              {t("send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
