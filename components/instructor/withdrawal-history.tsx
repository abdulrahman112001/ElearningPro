"use client"

import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Withdrawal {
  id: string
  amount: number
  currency: string
  method: string
  status: string
  createdAt: Date
  processedAt: Date | null
}

interface WithdrawalHistoryProps {
  withdrawals: Withdrawal[]
}

export function WithdrawalHistory({ withdrawals }: WithdrawalHistoryProps) {
  const t = useTranslations("instructor")
  const locale = useLocale()
  const dateLocale = locale === "ar" ? ar : enUS

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            {t("completed")}
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            {t("pending")}
          </Badge>
        )
      case "REJECTED":
        return <Badge variant="destructive">{t("rejected")}</Badge>
      case "APPROVED":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            {t("approved")}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "paypal":
        return "PayPal"
      case "bank":
        return t("bankTransfer")
      case "payoneer":
        return "Payoneer"
      default:
        return method
    }
  }

  if (withdrawals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t("noWithdrawals")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {withdrawals.map((withdrawal) => (
        <div
          key={withdrawal.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(withdrawal.status)}
            <div>
              <p className="font-medium">
                ${withdrawal.amount.toFixed(2)} {withdrawal.currency}
              </p>
              <p className="text-sm text-muted-foreground">
                {getMethodLabel(withdrawal.method)} •{" "}
                {format(new Date(withdrawal.createdAt), "PPP", {
                  locale: dateLocale,
                })}
              </p>
            </div>
          </div>
          {getStatusBadge(withdrawal.status)}
        </div>
      ))}
    </div>
  )
}
