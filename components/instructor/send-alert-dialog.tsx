"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { BellRing, CheckCircle2, Loader2, MailWarning, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const TITLE_MAX = 150
const MESSAGE_MAX = 3000

export interface SendAlertDialogProps {
  student: {
    id: string
    name: string | null
    hasGuardianEmail: boolean
  }
  /** Custom trigger; defaults to a small outline "Send alert" button */
  trigger?: React.ReactNode
  /** Render the default trigger as an icon-only button (compact tables) */
  iconOnly?: boolean
  onSent?: () => void
}

type Result = { toGuardian: boolean; emailDelivered: boolean; emailError?: string }

/**
 * Lets a teacher alert one of their students (in-app notification), with an
 * optional copy emailed to the guardian. Used on the results and students pages.
 */
export function SendAlertDialog({ student, trigger, iconOnly = false, onSent }: SendAlertDialogProps) {
  const t = useTranslations("alerts")
  const tc = useTranslations("common")
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [toGuardian, setToGuardian] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Result | null>(null)

  const studentName = student.name?.trim() || t("theStudent")

  const reset = () => {
    setTitle("")
    setMessage("")
    setToGuardian(false)
    setError(null)
    setResult(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError(t("titleRequired"))
    if (!message.trim()) return setError(t("messageRequired"))
    setError(null)
    setSending(true)
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          title: title.trim(),
          message: message.trim(),
          toGuardian: student.hasGuardianEmail ? toGuardian : false,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.code === "no_guardian_email") setError(t("errorNoGuardian"))
        else if (res.status === 403) setError(t("errorForbidden"))
        else setError(t("errorGeneric"))
        return
      }
      setResult({
        toGuardian: !!data.toGuardian,
        emailDelivered: !!data.emailDelivered,
        emailError: data.emailError,
      })
      toast.success(t("sent"))
      onSent?.()
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          iconOnly ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("sendAlertTo", { name: studentName })}>
              <BellRing className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              {t("sendAlert")}
            </Button>
          )
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {t("sendAlertTo", { name: studentName })}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/10 p-4 text-success">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{t("sentToStudent")}</p>
            </div>
            {result.toGuardian && (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4",
                  result.emailDelivered
                    ? "border-success/20 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/15 text-amber-800 dark:text-amber-300"
                )}
              >
                {result.emailDelivered ? (
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <MailWarning className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {result.emailDelivered ? t("guardianDelivered") : t("guardianFailed")}
                  </p>
                  {!result.emailDelivered && result.emailError && (
                    <p className="mt-1 break-words text-xs opacity-80" dir="auto">
                      {result.emailError}
                    </p>
                  )}
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={reset}>
                {t("sendAnother")}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>{t("close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`alert-title-${student.id}`}>{t("titleLabel")}</Label>
              <Input
                id={`alert-title-${student.id}`}
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`alert-message-${student.id}`}>{t("messageLabel")}</Label>
                <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>
              <Textarea
                id={`alert-message-${student.id}`}
                value={message}
                maxLength={MESSAGE_MAX}
                rows={5}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                disabled={sending}
              />
            </div>
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                !student.hasGuardianEmail && "bg-muted/40"
              )}
            >
              <Checkbox
                id={`alert-guardian-${student.id}`}
                checked={toGuardian}
                onCheckedChange={(v) => setToGuardian(v === true)}
                disabled={!student.hasGuardianEmail || sending}
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-0.5">
                <Label
                  htmlFor={`alert-guardian-${student.id}`}
                  className={cn(!student.hasGuardianEmail && "text-muted-foreground")}
                >
                  {t("toGuardian")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {student.hasGuardianEmail ? t("toGuardianHint") : t("noGuardianEmail")}
                </p>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={sending} className="gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                {sending ? t("sending") : t("send")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
