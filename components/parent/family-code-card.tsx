"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Check, Copy, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
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

/** Shows the student's parent link code with copy + regenerate. */
export function FamilyCodeCard({ initialCode }: { initialCode: string }) {
  const t = useTranslations("parent.family")
  const tc = useTranslations("common")
  const [code, setCode] = useState(initialCode)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("copyFailed"))
    }
  }

  async function regenerate() {
    setBusy(true)
    try {
      const res = await fetch("/api/student/parent-code", { method: "POST" })
      if (!res.ok) throw new Error()
      setCode((await res.json()).code)
      toast.success(t("regenerated"))
    } catch {
      toast.error(t("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <output
          dir="ltr"
          aria-label={t("codeLabel")}
          className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 font-mono text-2xl font-bold tracking-[0.25em] text-primary sm:text-3xl"
        >
          {code}
        </output>
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? tc("copied") : t("copy")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("codeHelp")}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {t("regenerate")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("regenerateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("regenerateDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={regenerate}>{t("regenerate")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
