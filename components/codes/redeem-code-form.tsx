"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { CheckCircle2, Loader2, Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatPrice } from "@/lib/utils"

export interface RedeemResult {
  type: "COURSE" | "SUBSCRIPTION" | "WALLET"
  course?: { id: string; slug: string; titleAr: string; titleEn: string }
  months?: number
  endsAt?: string
  instructor?: { id: string; name: string | null } | null
  amount?: number
  balance?: number
}

const ERROR_KEYS = [
  "invalid",
  "already_used",
  "expired",
  "disabled",
  "already_enrolled",
  "own_code",
  "students_only",
] as const

/** Formats what the student types into XXXX-XXXX-XXXX as they go. */
function formatInput(value: string) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
  return raw.match(/.{1,4}/g)?.join("-") ?? ""
}

export interface RedeemCodeFormProps {
  onRedeemed?: (result: RedeemResult) => void
  /** Navigate to the unlocked content after success (default true) */
  navigate?: boolean
  className?: string
  autoFocus?: boolean
}

export function RedeemCodeForm({ onRedeemed, navigate = true, className, autoFocus }: RedeemCodeFormProps) {
  const t = useTranslations("accessCodes")
  const locale = useLocale()
  const router = useRouter()
  const [code, setCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const id = React.useId()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (code.replace(/-/g, "").length !== 12) {
      setError(t("errors.invalid"))
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const result = data as RedeemResult
        const name = (c?: RedeemResult["course"]) => (c ? (locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr) : "")
        const message =
          result.type === "COURSE"
            ? t("redeemed.course", { course: name(result.course) })
            : result.type === "SUBSCRIPTION"
              ? t("redeemed.subscription", { months: result.months ?? 1, teacher: result.instructor?.name ?? "" })
              : t("redeemed.wallet", { amount: formatPrice(result.amount ?? 0, "EGP", locale) })
        setSuccess(message)
        setCode("")
        toast.success(message)
        onRedeemed?.(result)
        if (navigate) {
          if (result.type === "COURSE" && result.course) router.push(`/courses/${result.course.slug}/learn`)
          else if (result.type === "SUBSCRIPTION") router.push("/student/subscriptions")
        }
        router.refresh()
        return
      }
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (res.status === 429) setError(t("errors.rate_limited"))
      else if ((ERROR_KEYS as readonly string[]).includes(data.code)) setError(t(`errors.${data.code as (typeof ERROR_KEYS)[number]}`))
      else setError(t("errors.generic"))
    } catch {
      setError(t("errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t("codeLabel")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={id}
            value={code}
            onChange={(e) => {
              setCode(formatInput(e.target.value))
              setError(null)
            }}
            placeholder="XXXX-XXXX-XXXX"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus={autoFocus}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="font-mono text-base tracking-widest sm:flex-1"
          />
          <Button type="submit" disabled={loading || !code} className="shrink-0">
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Ticket aria-hidden="true" />}
            {t("redeem")}
          </Button>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="inline-flex items-start gap-1.5 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {success}
        </p>
      )}
    </form>
  )
}
