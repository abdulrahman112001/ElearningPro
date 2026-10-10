"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { Crown, Loader2, RefreshCw } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn, formatPrice } from "@/lib/utils"
import { PayFromWalletButton, useWalletBalance } from "@/components/wallet/pay-from-wallet-button"
import { RedeemCodeDialog } from "@/components/codes/redeem-code-dialog"

export interface SubscribeButtonProps {
  instructorId: string
  monthlyPrice: number
  currency?: string
  /** The student already has an active subscription: the button renews it */
  subscribed?: boolean
  /** "resubscribe" wording for a lapsed subscription */
  expired?: boolean
  /** Override the default label */
  label?: React.ReactNode
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  /** Also offer "Pay from wallet" and "Have a code?" under the button */
  alternatives?: boolean
  /** With alternatives: also show the "Have a code?" link (default true) */
  codeLink?: boolean
  /** Called after a free subscription is activated in place */
  onActivated?: () => void
}

/**
 * Starts or renews a monthly subscription to a teacher. Paid plans go to
 * Stripe checkout; free plans activate immediately and refresh the page.
 */
export function SubscribeButton({
  instructorId,
  monthlyPrice,
  currency = "EGP",
  subscribed = false,
  expired = false,
  label,
  size = "default",
  variant = "default",
  className,
  onActivated,
  alternatives = false,
  codeLink = true,
}: SubscribeButtonProps) {
  const t = useTranslations("subscriptions")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { status } = useSession()
  const [loading, setLoading] = useState(false)
  const showAlternatives = alternatives && monthlyPrice > 0 && status === "authenticated"
  const { balance } = useWalletBalance(showAlternatives)

  const price = formatPrice(monthlyPrice, currency, locale)
  const text =
    label ??
    (subscribed
      ? t("renew")
      : expired
        ? t("resubscribe")
        : monthlyPrice > 0
          ? t("subscribeFor", { price })
          : t("subscribeFree"))

  const handleClick = async () => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId, paymentMethod: "stripe" }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.redirectUrl) {
        toast.loading(t("redirecting"))
        window.location.href = data.redirectUrl
        return
      }
      if (res.ok && data.activated) {
        toast.success(t("activated"))
        onActivated?.()
        router.refresh()
        setLoading(false)
        return
      }
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`)
        setLoading(false)
        return
      }
      toast.error(res.status === 501 ? t("methodUnavailable") : t("error"))
    } catch {
      toast.error(t("error"))
    }
    setLoading(false)
  }

  const Icon = subscribed || expired ? RefreshCw : Crown

  const button = (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(className)}
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon aria-hidden="true" />
      )}
      {loading ? t("processing") : text}
    </Button>
  )

  if (!showAlternatives) return button

  return (
    <div className="w-full space-y-2">
      {button}
      <PayFromWalletButton
        kind="subscription"
        id={instructorId}
        price={monthlyPrice}
        balance={balance}
        size={size === "lg" ? "default" : "sm"}
        onPaid={() => onActivated?.()}
      />
      {codeLink && (
        <div className="flex justify-center">
          <RedeemCodeDialog
            variant="link"
            className="h-auto px-0 text-sm"
            onRedeemed={(r) => r.type === "SUBSCRIPTION" && onActivated?.()}
          />
        </div>
      )}
    </div>
  )
}
