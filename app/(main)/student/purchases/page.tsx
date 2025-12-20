"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import {
  ShoppingBag,
  Calendar,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Receipt,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Purchase {
  id: string
  amount: number
  currency: string
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
  paymentMethod?: string
  createdAt: string
  course: {
    id: string
    slug: string
    titleAr?: string
    titleEn?: string
    thumbnail?: string
    instructor: {
      name: string
    }
  }
}

export default function StudentPurchasesPage() {
  const t = useTranslations("student")
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const res = await fetch("/api/student/purchases")
        if (res.ok) {
          const data = await res.json()
          setPurchases(data)
        }
      } catch (error) {
        console.error("Error fetching purchases:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPurchases()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 me-1" />
            {t("completed") || "مكتمل"}
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 me-1" />
            {t("pending") || "قيد الانتظار"}
          </Badge>
        )
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 me-1" />
            {t("failed") || "فشل"}
          </Badge>
        )
      case "REFUNDED":
        return <Badge variant="outline">{t("refunded") || "مسترد"}</Badge>
      default:
        return null
    }
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: currency || "EGP",
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("purchases")}</h1>
        <p className="text-muted-foreground">
          {t("purchasesDescription") || "سجل مشترياتك ومعاملاتك المالية"}
        </p>
      </div>

      {purchases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">
              {t("noPurchases") || "لا توجد مشتريات"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {t("noPurchasesDescription") || "لم تقم بشراء أي كورسات بعد"}
            </p>
            <Button asChild>
              <Link href="/courses">{t("browseCourses")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("totalPurchases") || "إجمالي المشتريات"}
                    </p>
                    <p className="text-2xl font-bold">{purchases.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("completedPurchases") || "مكتملة"}
                    </p>
                    <p className="text-2xl font-bold">
                      {purchases.filter((p) => p.status === "COMPLETED").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("totalSpent") || "إجمالي المدفوع"}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatPrice(
                        purchases
                          .filter((p) => p.status === "COMPLETED")
                          .reduce((sum, p) => sum + p.amount, 0),
                        "EGP"
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Purchases List */}
          <Card>
            <CardHeader>
              <CardTitle>{t("purchaseHistory") || "سجل المشتريات"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="py-4 first:pt-0 last:pb-0 flex items-center gap-4"
                  >
                    <div className="relative h-16 w-24 rounded-md overflow-hidden flex-shrink-0">
                      {purchase.course.thumbnail ? (
                        <Image
                          src={purchase.course.thumbnail}
                          alt={
                            purchase.course.titleAr ||
                            purchase.course.titleEn ||
                            ""
                          }
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/courses/${purchase.course.slug}`}
                        className="font-medium hover:text-primary line-clamp-1"
                      >
                        {purchase.course.titleAr || purchase.course.titleEn}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {purchase.course.instructor.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(purchase.createdAt), "dd MMM yyyy", {
                          locale: ar,
                        })}
                      </div>
                    </div>

                    <div className="text-end">
                      <p className="font-semibold">
                        {formatPrice(purchase.amount, purchase.currency)}
                      </p>
                      <div className="mt-1">
                        {getStatusBadge(purchase.status)}
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/courses/${purchase.course.slug}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
