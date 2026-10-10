"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Wallet } from "lucide-react"
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
} from "@/components/ui/alert-dialog"

/** Student: pays a due group fee from the wallet balance. */
export function PayWalletButton({
  feeId,
  amountLabel,
  groupName,
  disabled,
}: {
  feeId: string
  amountLabel: string
  groupName: string
  disabled?: boolean
}) {
  const t = useTranslations("fees.student")
  const tc = useTranslations("common")
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const pay = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/fees/${feeId}/pay-wallet`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 402 || data?.code === "insufficient_balance") {
        toast.error(t("insufficient"))
        setOpen(false)
        return
      }
      if (!res.ok) throw new Error()
      toast.success(t("paid", { receipt: data.receiptNo ?? "" }))
      setOpen(false)
      router.refresh()
    } catch {
      toast.error(t("payFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" className="h-8 gap-1" onClick={() => setOpen(true)} disabled={disabled}>
        <Wallet className="h-3.5 w-3.5" />
        {t("payWallet")}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDescription", { amount: amountLabel, group: groupName })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                pay()
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("payWallet")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
