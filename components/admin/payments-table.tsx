"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import {
  Search,
  CreditCard,
  DollarSign,
  MoreVertical,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaymentUser {
  id: string
  name: string | null
  email: string
  image?: string | null
}

interface PaymentCourse {
  id: string
  titleEn: string
  titleAr?: string | null
  instructor?: {
    name: string | null
  } | null
}

interface PaymentCoupon {
  code: string
  discountValue: number
  discountType: string
}

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  provider: string
  providerId?: string | null
  discountAmount: number
  instructorShare: number
  platformShare: number
  createdAt: string
  user: PaymentUser
  course: PaymentCourse
  coupon: PaymentCoupon | null
}

interface PaymentsTableProps {
  payments: Payment[]
  stats: {
    totalAmount: number
    totalCount: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const statusVariants: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-600",
  REFUNDED: "bg-blue-50 text-blue-700",
}

const statusOptions = ["all", "COMPLETED", "PENDING", "FAILED", "REFUNDED"]

export function PaymentsTable({
  payments,
  stats,
  pagination,
}: PaymentsTableProps) {
  const t = useTranslations("admin")
  const common = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams() as URLSearchParams
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  )

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
        style: "currency",
        currency: "USD",
      }),
    [locale]
  )

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")
    router.push(`/admin/payments?${params.toString()}`)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set("status", value)
    else params.delete("status")
    params.delete("page")
    router.push(`/admin/payments?${params.toString()}`)
  }

  const formatDate = (value: string) => {
    try {
      return format(new Date(value), "PPpp", { locale: dateLocale })
    } catch (error) {
      return "—"
    }
  }

  const getStatusBadge = (status: string) => {
    const base = statusVariants[status] || "bg-muted text-muted-foreground"
    return (
      <Badge variant="outline" className={base}>
        {t(status.toLowerCase())}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("totalRevenue")}
              </p>
              <p className="text-2xl font-semibold">
                {currencyFormatter.format(stats.totalAmount || 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("totalTransactions")}
              </p>
              <p className="text-2xl font-semibold">{stats.totalCount}</p>
            </div>
            <CreditCard className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-1 gap-2 lg:max-w-lg">
          <Input
            placeholder={t("searchPayments")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder={t("statusFilter")} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "all" ? common("all") : t(option.toLowerCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("student")}</TableHead>
              <TableHead>{t("course")}</TableHead>
              <TableHead>{t("amount")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("provider")}</TableHead>
              <TableHead>{t("coupon")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {payment.user.name || t("unnamed")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {payment.user.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {locale === "ar"
                        ? payment.course.titleAr || payment.course.titleEn
                        : payment.course.titleEn}
                    </span>
                    {payment.course.instructor?.name && (
                      <span className="text-sm text-muted-foreground">
                        {t("byInstructor", {
                          name: payment.course.instructor.name,
                        })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold">
                      {currencyFormatter.format(payment.amount)}
                    </span>
                    {payment.discountAmount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {t("afterDiscount", {
                          value: currencyFormatter.format(
                            payment.discountAmount
                          ),
                        })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{payment.provider}</span>
                    {payment.providerId && (
                      <span className="text-xs text-muted-foreground">
                        {payment.providerId}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {payment.coupon ? (
                    <Badge variant="secondary">{payment.coupon.code}</Badge>
                  ) : (
                    <span className="text-muted-foreground">
                      {common("none")}
                    </span>
                  )}
                </TableCell>
                <TableCell>{formatDate(payment.createdAt)}</TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {payment.providerId ? (
                        <DropdownMenuItem
                          className="flex items-center gap-2"
                          onClick={() => {
                            if (!payment.providerId) return
                            navigator.clipboard.writeText(payment.providerId)
                            toast.success(common("copied"))
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t("copyTransactionId")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {t("paginationLabel", {
            start: (pagination.page - 1) * pagination.limit + 1,
            end: Math.min(pagination.page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page - 1))
              router.push(`/admin/payments?${params.toString()}`)
            }}
          >
            {common("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.pages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page + 1))
              router.push(`/admin/payments?${params.toString()}`)
            }}
          >
            {common("next")}
          </Button>
        </div>
      </div>
    </div>
  )
}
