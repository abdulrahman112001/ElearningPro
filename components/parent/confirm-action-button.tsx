"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
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

interface Props {
  /** Request to send on confirm */
  url: string
  method?: "DELETE" | "POST"
  label: string
  /** Rendered icon element (server pages cannot pass component functions) */
  icon?: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  successMessage: string
  /** Where to go afterwards; refreshes the current page when omitted */
  redirectTo?: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
}

/** Button + confirmation dialog for destructive parent/family actions. */
export function ConfirmActionButton({
  url,
  method = "DELETE",
  label,
  icon,
  title,
  description,
  confirmLabel,
  successMessage,
  redirectTo,
  variant = "outline",
  size = "sm",
}: Props) {
  const tc = useTranslations("common")
  const t = useTranslations("parent.common")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await fetch(url, { method })
      if (!res.ok) throw new Error()
      toast.success(successMessage)
      setOpen(false)
      if (redirectTo) router.push(redirectTo)
      router.refresh()
    } catch {
      toast.error(t("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={busy}>
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              run()
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
