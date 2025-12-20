"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import toast from "react-hot-toast"
import { Loader2, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const withdrawalSchema = z.object({
  amount: z.number().min(50, "Minimum withdrawal is $50"),
  method: z.enum(["bank", "paypal", "payoneer"]),
  paypalEmail: z.string().email().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
})

type WithdrawalFormData = z.infer<typeof withdrawalSchema>

interface WithdrawalRequestDialogProps {
  availableBalance: number
}

export function WithdrawalRequestDialog({
  availableBalance,
}: WithdrawalRequestDialogProps) {
  const t = useTranslations("instructor")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: Math.min(availableBalance, 100),
      method: "paypal",
    },
  })

  const watchMethod = form.watch("method")

  const onSubmit = async (data: WithdrawalFormData) => {
    setIsSubmitting(true)

    try {
      const paymentDetails: any = {}

      if (data.method === "paypal") {
        paymentDetails.paypalEmail = data.paypalEmail
      } else if (data.method === "bank") {
        paymentDetails.bankName = data.bankName
        paymentDetails.accountNumber = data.accountNumber
        paymentDetails.routingNumber = data.routingNumber
        paymentDetails.swiftCode = data.swiftCode
      }

      const response = await fetch("/api/instructor/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount,
          method: data.method,
          paymentDetails,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to request withdrawal")
      }

      toast.success(t("withdrawalRequested"))
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <DollarSign className="me-2 h-4 w-4" />
          {t("requestWithdrawal")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("requestWithdrawal")}</DialogTitle>
          <DialogDescription>
            {t("availableBalance")}: ${availableBalance.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("amount")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        $
                      </span>
                      <Input
                        type="number"
                        min={50}
                        max={availableBalance}
                        className="pl-8"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t("minimumWithdrawal")}: $50
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("paymentMethod")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
                      <SelectItem value="payoneer">Payoneer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PayPal Fields */}
            {watchMethod === "paypal" && (
              <FormField
                control={form.control}
                name="paypalEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("paypalEmail")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Bank Fields */}
            {watchMethod === "bank" && (
              <>
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("bankName")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("accountNumber")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="routingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("routingNumber")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="swiftCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("swiftCode")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {t("submit")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
