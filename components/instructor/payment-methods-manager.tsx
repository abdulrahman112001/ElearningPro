"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { CreditCard, Building2, Loader2, Plus, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PaymentMethodsManagerProps {
  paypalEmail?: string | null
  bankName?: string | null
  bankAccount?: string | null
  onUpdate?: () => void
}

export function PaymentMethodsManager({
  paypalEmail,
  bankName,
  bankAccount,
  onUpdate,
}: PaymentMethodsManagerProps) {
  const t = useTranslations("instructor")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("paypal")

  const [formData, setFormData] = useState({
    paypalEmail: paypalEmail || "",
    bankName: bankName || "",
    bankAccount: bankAccount || "",
  })

  const hasPaymentMethod = paypalEmail || bankName

  const handleSubmit = async () => {
    // Validate based on active tab
    if (activeTab === "paypal" && !formData.paypalEmail) {
      toast.error(
        t("paypalEmailRequired") || "البريد الإلكتروني لـ PayPal مطلوب"
      )
      return
    }
    if (activeTab === "bank" && (!formData.bankName || !formData.bankAccount)) {
      toast.error(t("bankDetailsRequired") || "بيانات البنك مطلوبة")
      return
    }

    setIsSubmitting(true)

    try {
      // Only send the active payment method
      const dataToSend =
        activeTab === "paypal"
          ? { paypalEmail: formData.paypalEmail }
          : { bankName: formData.bankName, bankAccount: formData.bankAccount }

      const response = await fetch("/api/instructor/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update payment methods")
      }

      toast.success(t("paymentMethodUpdated") || "تم تحديث طريقة الدفع بنجاح")
      setOpen(false)
      if (onUpdate) {
        onUpdate()
      }
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {hasPaymentMethod ? (
        <div className="space-y-3">
          {paypalEmail && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full dark:bg-blue-900">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-muted-foreground">{paypalEmail}</p>
                </div>
              </div>
            </div>
          )}
          {bankName && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full dark:bg-green-900">
                  <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium">{bankName}</p>
                  <p className="text-sm text-muted-foreground">
                    {bankAccount ? `****${bankAccount.slice(-4)}` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">
          {t("paymentMethodsDescription")}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            {hasPaymentMethod ? (
              <>
                <Pencil className="h-4 w-4 me-2" />
                {t("editPaymentMethod") || "تعديل طريقة الدفع"}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 me-2" />
                {t("addPaymentMethod")}
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasPaymentMethod
                ? t("editPaymentMethod")
                : t("addPaymentMethod")}
            </DialogTitle>
            <DialogDescription>
              {t("paymentMethodsDescription")}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paypal">PayPal</TabsTrigger>
              <TabsTrigger value="bank">{t("bankTransfer")}</TabsTrigger>
            </TabsList>

            <TabsContent value="paypal" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("paypalEmail")}</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={formData.paypalEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, paypalEmail: e.target.value })
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t("bankName")}</Label>
                <Input
                  placeholder={t("bankNamePlaceholder") || "اسم البنك"}
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("accountNumber")}</Label>
                <Input
                  placeholder={t("accountNumberPlaceholder") || "رقم الحساب"}
                  value={formData.bankAccount}
                  onChange={(e) =>
                    setFormData({ ...formData, bankAccount: e.target.value })
                  }
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              )}
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
