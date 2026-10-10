"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Send, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

/** "Send weekly reports now" + "send a test WhatsApp" for admins. */
export function AdminMessagingActions() {
  const t = useTranslations("parent.admin")
  const tc = useTranslations("common")
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [phone, setPhone] = useState("")
  const [testing, setTesting] = useState(false)

  async function runNow() {
    setRunning(true)
    try {
      const res = await fetch("/api/admin/messaging/weekly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!res.ok) throw new Error()
      const r = await res.json()
      toast.success(t("runDone", { sent: r.sent + r.logged, failed: r.failed, skipped: r.skipped }))
      router.refresh()
    } catch {
      toast.error(t("error"))
    } finally {
      setRunning(false)
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault()
    setTesting(true)
    try {
      const res = await fetch("/api/admin/messaging/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 400) toast.error(t("invalidPhone"))
      else if (!res.ok) toast.error(t("error"))
      else {
        if (data.status === "FAILED") toast.error(t("testFailed", { error: data.error ?? "" }))
        else toast.success(t("testDone", { status: data.status }))
        router.refresh()
      }
    } catch {
      toast.error(t("error"))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 rounded-lg border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="font-semibold">{t("runTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("runDescription")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={running}>
              {running ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {t("runNow")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("runConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("runConfirmDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={runNow}>{t("runNow")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <form onSubmit={sendTest} className="space-y-3 rounded-lg border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="font-semibold">{t("testTitle")}</h2>
        <div className="space-y-2">
          <Label htmlFor="test-phone">{t("testPhone")}</Label>
          <Input
            id="test-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={testing || !phone.trim()}>
          {testing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
          {t("testSend")}
        </Button>
      </form>
    </div>
  )
}
