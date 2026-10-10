"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Save, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CardSkeleton, SectionCard } from "@/components/shared"
import type { ReceivingAccounts } from "./topup-form"

/** Admin: the numbers/accounts students transfer money to. */
export function PaymentSettingsCard() {
  const t = useTranslations("manualPayments")
  const [values, setValues] = React.useState<ReceivingAccounts | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/admin/payment-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setValues(d ?? { vodafoneCashNumber: "", instapayAddress: "", bankDetails: "" }))
      .catch(() => setValues({ vodafoneCashNumber: "", instapayAddress: "", bankDetails: "" }))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error()
      setValues(await res.json())
      toast.success(t("settingsSaved"))
    } catch {
      toast.error(t("settingsError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard icon={Settings2} title={t("settingsTitle")} description={t("settingsDescription")}>
      {!values ? (
        <CardSkeleton withImage={false} />
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps-vodafone">{t("vodafoneCashNumber")}</Label>
              <Input
                id="ps-vodafone"
                dir="ltr"
                inputMode="tel"
                value={values.vodafoneCashNumber}
                onChange={(e) => setValues({ ...values, vodafoneCashNumber: e.target.value })}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ps-instapay">{t("instapayAddress")}</Label>
              <Input
                id="ps-instapay"
                dir="ltr"
                value={values.instapayAddress}
                onChange={(e) => setValues({ ...values, instapayAddress: e.target.value })}
                maxLength={200}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-bank">{t("bankDetails")}</Label>
            <Textarea
              id="ps-bank"
              rows={3}
              value={values.bankDetails}
              onChange={(e) => setValues({ ...values, bankDetails: e.target.value })}
              maxLength={1000}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
            {t("save")}
          </Button>
        </form>
      )}
    </SectionCard>
  )
}
