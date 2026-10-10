"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { Loader2, Wallet } from "lucide-react"
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
} from "@/components/ui/alert-dialog"
import { cn, formatPrice } from "@/lib/utils"

/** The signed-in user's wallet balance (null while loading / signed out). */
export function useWalletBalance(enabled = true) {
  const { status } = useSession()
  const [balance, setBalance] = React.useState<number | null>(null)
  const load = React.useCallback(() => {
    if (!enabled || status !== "authenticated") return
    fetch("/api/wallet/balance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBalance(Number(d.balance) || 0))
      .catch(() => {})
  }, [status, enabled])
  React.useEffect(load, [load])
  return { balance, reload: load, setBalance }
}

export interface PayFromWalletButtonProps {
  kind: "course" | "subscription"
  /** course id or instructor id */
  id: string
  price: number
  /** What is being bought, for the confirmation dialog */
  itemName?: string
  balance: number | null
  onPaid?: (data: { balance: number; slug?: string }) => void
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
}

/**
 * "Pay from wallet (balance X)". Confirms, then pays in one request; when
 * the balance is too low it links to the wallet top-up instead.
 */
export function PayFromWalletButton({
  kind,
  id,
  price,
  itemName,
  balance,
  onPaid,
  size = "default",
  variant = "outline",
  className,
}: PayFromWalletButtonProps) {
  const t = useTranslations("wallet")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  if (status !== "authenticated" || balance === null || !(price > 0)) return null

  const money = (v: number) => (v === 0 ? new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(0) : formatPrice(v, "EGP", locale))
  const enough = balance >= price

  if (!enough) {
    return (
      <div className={cn("rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground", className)}>
        <p>{t("payLowBalance", { balance: money(balance) })}</p>
        <Link
          href={`/student/wallet?topup=1&returnTo=${encodeURIComponent(pathname || "/")}`}
          className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("topUpWallet")}
        </Link>
      </div>
    )
  }

  const pay = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(kind === "course" ? t("paidCourse") : t("paidSubscription"))
        setOpen(false)
        onPaid?.({ balance: data.balance, slug: data.slug })
        router.refresh()
        return
      }
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`)
        return
      }
      if (res.status === 402) toast.error(t("insufficient", { balance: money(data.balance ?? 0), required: money(data.required ?? price) }))
      else if (data.code === "already_enrolled") toast.error(t("alreadyEnrolled"))
      else if (data.code === "group_only") toast.error(t("groupOnly"))
      else toast.error(t("payError"))
    } catch {
      toast.error(t("payError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("h-auto min-h-10 w-full whitespace-normal py-2", className)}
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Wallet aria-hidden="true" />}
        {t("payFromWallet", { balance: money(balance) })}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPayTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmPayBody", {
                price: money(price),
                item: itemName ?? "",
                after: money(Math.round((balance - price) * 100) / 100),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault()
                pay()
              }}
            >
              {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("confirmPay")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
