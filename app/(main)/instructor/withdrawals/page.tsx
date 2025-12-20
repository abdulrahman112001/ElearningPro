import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { DollarSign, Clock, CheckCircle, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { WithdrawalRequestDialog } from "@/components/instructor/withdrawal-request-dialog"
import { PaymentMethodsManager } from "@/components/instructor/payment-methods-manager"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("withdrawals"),
  }
}

export default async function InstructorWithdrawalsPage() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  // Get instructor profile with earnings
  const profile = await db.instructorProfile.findUnique({
    where: { userId: session.user.id },
  })

  // Get withdrawal requests
  const withdrawals = await db.withdrawal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  // Calculate paid earnings from completed withdrawals
  const paidEarnings = withdrawals
    .filter((w) => w.status === "COMPLETED")
    .reduce((sum, w) => sum + w.amount, 0)

  const stats = {
    total: profile?.totalEarnings || 0,
    pending: profile?.pendingEarnings || 0,
    paid: paidEarnings,
    available: profile?.pendingEarnings || 0,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">{t("pending")}</Badge>
      case "APPROVED":
        return (
          <Badge className="bg-blue-500">{t("approved") || "موافق عليه"}</Badge>
        )
      case "COMPLETED":
        return (
          <Badge className="bg-green-500">{t("completed") || "مكتمل"}</Badge>
        )
      case "REJECTED":
        return <Badge variant="destructive">{t("rejected")}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "paypal":
        return "PayPal"
      case "bank":
        return t("bankTransfer") || "تحويل بنكي"
      case "payoneer":
        return "Payoneer"
      default:
        return method
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("withdrawals")}</h1>
          <p className="text-muted-foreground">
            {t("withdrawalsDescription") || "إدارة طلبات السحب والأرباح"}
          </p>
        </div>
        <WithdrawalRequestDialog availableBalance={stats.available} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEarnings")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.total.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("availableBalance") || "الرصيد المتاح"}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.available.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("pendingEarnings")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${stats.pending.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("paidEarnings")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.paid.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Requests */}
      <Card>
        <CardHeader>
          <CardTitle>{t("withdrawalHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("noWithdrawals")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("noWithdrawalsDescription")}
              </p>
              <WithdrawalRequestDialog availableBalance={stats.available} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("withdrawalAmount")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("date") || "التاريخ"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-medium">
                      ${withdrawal.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{getMethodLabel(withdrawal.method)}</TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell>
                      {new Date(withdrawal.createdAt).toLocaleDateString(
                        "ar-EG",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>{t("paymentMethods")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodsManager
            paypalEmail={profile?.paypalEmail}
            bankName={profile?.bankName}
            bankAccount={profile?.bankAccount}
          />
        </CardContent>
      </Card>
    </div>
  )
}
