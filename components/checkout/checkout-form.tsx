"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import {
  CreditCard,
  Wallet,
  Building2,
  Smartphone,
  Loader2,
  Shield,
  CheckCircle,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface Course {
  id: string
  titleEn: string
  titleAr?: string
  slug: string
  thumbnail?: string
  price: number
  discountPrice?: number
  instructor: {
    name: string
    image?: string
  }
}

interface CheckoutFormProps {
  course: Course
  finalPrice: number
}

type PaymentMethod = "stripe" | "paypal" | "paymob" | "tap"

export function CheckoutForm({ course, finalPrice }: CheckoutFormProps) {
  const t = useTranslations("checkout")
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe")
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount: number
  } | null>(null)

  const discountAmount = appliedCoupon?.discount || 0
  const total = Math.max(0, finalPrice - discountAmount)

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode,
          courseId: course.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Invalid coupon")
      }

      const data = await response.json()
      setAppliedCoupon({
        code: couponCode,
        discount: data.discount,
      })
      toast.success(t("couponApplied"))
    } catch (error) {
      toast.error(t("invalidCoupon"))
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
  }

  const handleCheckout = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          paymentMethod,
          couponCode: appliedCoupon?.code,
        }),
      })

      if (!response.ok) {
        throw new Error("Payment failed")
      }

      const data = await response.json()

      // Redirect to payment provider
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        // Payment completed (for some methods)
        toast.success(t("paymentSuccess"))
        router.push(`/courses/${course.slug}/learn`)
      }
    } catch (error) {
      toast.error(t("paymentError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentMethod")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-2 gap-4"
            >
              {/* Stripe */}
              <div>
                <RadioGroupItem
                  value="stripe"
                  id="stripe"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="stripe"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <CreditCard className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">{t("creditCard")}</span>
                  <span className="text-xs text-muted-foreground">
                    Visa, Mastercard
                  </span>
                </Label>
              </div>

              {/* PayPal */}
              <div>
                <RadioGroupItem
                  value="paypal"
                  id="paypal"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="paypal"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Wallet className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">PayPal</span>
                  <span className="text-xs text-muted-foreground">
                    {t("payWithPaypal")}
                  </span>
                </Label>
              </div>

              {/* Paymob (Egypt) */}
              <div>
                <RadioGroupItem
                  value="paymob"
                  id="paymob"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="paymob"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Smartphone className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Paymob</span>
                  <span className="text-xs text-muted-foreground">
                    {t("egyptPayments")}
                  </span>
                </Label>
              </div>

              {/* Tap (Gulf) */}
              <div>
                <RadioGroupItem value="tap" id="tap" className="peer sr-only" />
                <Label
                  htmlFor="tap"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Building2 className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Tap</span>
                  <span className="text-xs text-muted-foreground">
                    {t("gulfPayments")}
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Coupon Code */}
        <Card>
          <CardHeader>
            <CardTitle>{t("couponCode")}</CardTitle>
          </CardHeader>
          <CardContent>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{appliedCoupon.code}</span>
                  <span className="text-green-600">
                    (-{appliedCoupon.discount} ج.م)
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>
                  {t("remove")}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder={t("enterCouponCode")}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
                <Button variant="outline" onClick={handleApplyCoupon}>
                  {t("apply")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Lock className="h-5 w-5" />
          <span>{t("securePayment")}</span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>{t("orderSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Course Info */}
            <div className="flex gap-4">
              {course.thumbnail ? (
                <Image
                  src={course.thumbnail}
                  alt={course.titleEn}
                  width={80}
                  height={45}
                  className="rounded object-cover"
                />
              ) : (
                <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium line-clamp-2 text-sm">
                  {course.titleAr || course.titleEn}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {course.instructor.name}
                </p>
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("originalPrice")}
                </span>
                <span>{course.price} ج.م</span>
              </div>

              {course.discountPrice !== null &&
                course.discountPrice < course.price && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("discount")}</span>
                    <span>-{course.price - course.discountPrice} ج.م</span>
                  </div>
                )}

              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span>{t("couponDiscount")}</span>
                  <span>-{appliedCoupon.discount} ج.م</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between font-bold text-lg">
              <span>{t("total")}</span>
              <span>{total} ج.م</span>
            </div>

            {/* Checkout Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {t("completePurchase")}
            </Button>

            {/* Guarantee */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="h-4 w-4" />
              <span>{t("moneyBackGuarantee")}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
