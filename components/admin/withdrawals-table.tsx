"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import { CheckCircle, XCircle, Clock, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Withdrawal {
  id: string
  userId: string
  amount: number
  currency: string
  method: string
  status: string
  note: string | null
  createdAt: Date
  processedAt: Date | null
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface WithdrawalsTableProps {
  withdrawals: Withdrawal[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function WithdrawalsTable({
  withdrawals,
  pagination,
}: WithdrawalsTableProps) {
  const t = useTranslations("admin")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateLocale = locale === "ar" ? ar : enUS

  const [processing, setProcessing] = useState<string | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null)
  const [action, setAction] = useState<
    "approve" | "reject" | "complete" | null
  >(null)
  const [rejectReason, setRejectReason] = useState("")

  const handleProcess = async () => {
    if (!selectedWithdrawal || !action) return

    setProcessing(selectedWithdrawal.id)

    try {
      const status =
        action === "approve"
          ? "APPROVED"
          : action === "complete"
          ? "COMPLETED"
          : "REJECTED"

      const response = await fetch(
        `/api/admin/withdrawals/${selectedWithdrawal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            note: action === "reject" ? rejectReason : undefined,
          }),
        }
      )

      if (!response.ok) throw new Error("Failed to process withdrawal")

      toast.success(t("withdrawalProcessed"))
      setSelectedWithdrawal(null)
      setAction(null)
      setRejectReason("")
      router.refresh()
    } catch (error) {
      toast.error(t("error"))
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="me-1 h-3 w-3" />
            {t("completed")}
          </Badge>
        )
      case "APPROVED":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            {t("approved")}
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Clock className="me-1 h-3 w-3" />
            {t("pending")}
          </Badge>
        )
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <XCircle className="me-1 h-3 w-3" />
            {t("rejected")}
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

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-4">
        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(value) => {
            const params = new URLSearchParams(searchParams.toString())
            if (value && value !== "all") params.set("status", value)
            else params.delete("status")
            router.push(`/admin/withdrawals?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="PENDING">{t("pending")}</SelectItem>
            <SelectItem value="APPROVED">{t("approved")}</SelectItem>
            <SelectItem value="COMPLETED">{t("completed")}</SelectItem>
            <SelectItem value="REJECTED">{t("rejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("instructor")}</TableHead>
              <TableHead>{t("amount")}</TableHead>
              <TableHead>{t("method")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("requestedDate")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {t("noWithdrawals")}
                </TableCell>
              </TableRow>
            ) : (
              withdrawals.map((withdrawal) => (
                <TableRow key={withdrawal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {withdrawal.user.name || "No name"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {withdrawal.user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    ${withdrawal.amount.toFixed(2)} {withdrawal.currency}
                  </TableCell>
                  <TableCell>{getMethodLabel(withdrawal.method)}</TableCell>
                  <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                  <TableCell>
                    {format(new Date(withdrawal.createdAt), "PP", {
                      locale: dateLocale,
                    })}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal)
                          setAction(null)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {withdrawal.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal)
                              setAction("approve")
                            }}
                          >
                            {t("approve")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal)
                              setAction("reject")
                            }}
                          >
                            {t("reject")}
                          </Button>
                        </>
                      )}

                      {withdrawal.status === "APPROVED" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal)
                            setAction("complete")
                          }}
                        >
                          {t("markComplete")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details/Action Dialog */}
      <Dialog
        open={!!selectedWithdrawal}
        onOpenChange={() => {
          setSelectedWithdrawal(null)
          setAction(null)
          setRejectReason("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "reject"
                ? t("rejectWithdrawal")
                : action === "approve"
                ? t("approveWithdrawal")
                : action === "complete"
                ? t("completeWithdrawal")
                : t("withdrawalDetails")}
            </DialogTitle>
            <DialogDescription>
              {selectedWithdrawal && (
                <div className="space-y-2 mt-4 text-start">
                  <p>
                    <strong>{t("instructor")}:</strong>{" "}
                    {selectedWithdrawal.user.name} (
                    {selectedWithdrawal.user.email})
                  </p>
                  <p>
                    <strong>{t("amount")}:</strong> $
                    {selectedWithdrawal.amount.toFixed(2)}{" "}
                    {selectedWithdrawal.currency}
                  </p>
                  <p>
                    <strong>{t("method")}:</strong>{" "}
                    {getMethodLabel(selectedWithdrawal.method)}
                  </p>
                  {selectedWithdrawal.note && (
                    <div>
                      <strong>{t("paymentDetails")}:</strong>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs">
                        {JSON.stringify(
                          JSON.parse(selectedWithdrawal.note),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {action === "reject" && (
            <div className="py-4">
              <Textarea
                placeholder={t("rejectReasonPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}

          {action && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null)
                  setRejectReason("")
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleProcess}
                disabled={!!processing}
                variant={action === "reject" ? "destructive" : "default"}
              >
                {processing && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {action === "approve"
                  ? t("approve")
                  : action === "complete"
                  ? t("markComplete")
                  : t("reject")}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
