"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Copy, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const TOPUP_METHODS = ["VODAFONE_CASH", "INSTAPAY", "BANK_TRANSFER", "FAWRY"] as const
export type TopupMethod = (typeof TOPUP_METHODS)[number]

export interface ReceivingAccounts {
  vodafoneCashNumber: string
  instapayAddress: string
  bankDetails: string
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const t = useTranslations("wallet")
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <span className="min-w-0 break-all font-mono text-sm" dir="ltr">
        {value}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        aria-label={t("copy", { label })}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => toast.success(t("copied")),
            () => {}
          )
        }}
      >
        <Copy className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** Where to send the money for the selected method. */
function Instructions({ method, receiving }: { method: TopupMethod; receiving: ReceivingAccounts }) {
  const t = useTranslations("wallet")
  const value =
    method === "VODAFONE_CASH"
      ? receiving.vodafoneCashNumber
      : method === "INSTAPAY"
        ? receiving.instapayAddress
        : method === "BANK_TRANSFER"
          ? receiving.bankDetails
          : ""
  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
      <p className="font-medium">{t(`instructions.${method}`)}</p>
      {method === "BANK_TRANSFER" && value ? (
        <p className="whitespace-pre-line rounded-md border bg-background p-3" dir="auto">
          {value}
        </p>
      ) : value ? (
        <CopyValue value={value} label={t(`methods.${method}`)} />
      ) : method !== "FAWRY" ? (
        <p className="text-muted-foreground">{t("notConfigured")}</p>
      ) : null}
    </div>
  )
}

export function TopupForm({ receiving, onSubmitted }: { receiving: ReceivingAccounts; onSubmitted?: () => void }) {
  const t = useTranslations("wallet")
  const [method, setMethod] = React.useState<TopupMethod>("VODAFONE_CASH")
  const [amount, setAmount] = React.useState("")
  const [reference, setReference] = React.useState("")
  const [senderPhone, setSenderPhone] = React.useState("")
  const [note, setNote] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    const n = Number(amount)
    if (!amount || !Number.isFinite(n) || n < 10 || n > 20000) e.amount = t("errors.amount")
    if (reference.replace(/[\s\-_.#]/g, "").length < 4) e.reference = t("errors.reference")
    const phone = senderPhone.replace(/[\s\-()]/g, "")
    if (phone && !/^\+?\d{8,15}$/.test(phone)) e.senderPhone = t("errors.phone")
    if (!phone && method === "VODAFONE_CASH") e.senderPhone = t("errors.phoneRequired")
    return e
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, amount: Number(amount), reference, senderPhone: senderPhone || undefined, note: note || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(t("topupSubmitted"))
        setAmount("")
        setReference("")
        setNote("")
        onSubmitted?.()
        return
      }
      if (res.status === 409) toast.error(t("errors.duplicate"))
      else if (res.status === 429) toast.error(t("errors.tooMany"))
      else if (res.status === 400 && Array.isArray(data.fields)) {
        const mapped: Record<string, string> = {}
        for (const f of data.fields) mapped[f.field] = t("errors.field")
        setErrors(mapped)
      } else toast.error(t("errors.generic"))
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`topup-${name}-error`} className="text-xs text-destructive" role="alert">
        {errors[name]}
      </p>
    ) : null

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="topup-method">{t("method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as TopupMethod)}>
            <SelectTrigger id="topup-method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPUP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`methods.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="topup-amount">{t("amount")}</Label>
          <Input
            id="topup-amount"
            type="number"
            inputMode="decimal"
            min={10}
            max={20000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? "topup-amount-error" : undefined}
            dir="ltr"
          />
          {fieldError("amount")}
        </div>
      </div>

      <Instructions method={method} receiving={receiving} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="topup-reference">{t("reference")}</Label>
          <Input
            id="topup-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={64}
            aria-invalid={!!errors.reference}
            aria-describedby={errors.reference ? "topup-reference-error" : "topup-reference-hint"}
            dir="ltr"
          />
          {fieldError("reference") ?? (
            <p id="topup-reference-hint" className="text-xs text-muted-foreground">
              {t("referenceHint")}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="topup-phone">{t("senderPhone")}</Label>
          <Input
            id="topup-phone"
            type="tel"
            inputMode="tel"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            aria-invalid={!!errors.senderPhone}
            aria-describedby={errors.senderPhone ? "topup-senderPhone-error" : undefined}
            dir="ltr"
          />
          {fieldError("senderPhone")}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="topup-note">{t("note")}</Label>
        <Textarea id="topup-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </div>
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        {t("submitTopup")}
      </Button>
    </form>
  )
}
