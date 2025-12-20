"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Crown, Zap, Shield, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const plans = {
  monthly: {
    id: "monthly",
    price: 99,
    originalPrice: 149,
    period: "شهرياً",
    periodEn: "Monthly",
    discount: 33,
  },
  yearly: {
    id: "yearly",
    price: 799,
    originalPrice: 1188,
    period: "سنوياً",
    periodEn: "Yearly",
    discount: 33,
    savings: 389,
  },
}

const features = [
  "وصول غير محدود لجميع الكورسات",
  "شهادات معتمدة لكل كورس",
  "دعم فني على مدار الساعة",
  "تحميل الفيديوهات للمشاهدة أوفلاين",
  "وصول مبكر للكورسات الجديدة",
  "خصومات حصرية على الكورسات المميزة",
  "مجتمع خاص للمشتركين",
  "جلسات أسبوعية مع الخبراء",
]

export default function SubscriptionPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const planParam = searchParams?.get("plan") || "monthly"
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(
    planParam === "yearly" ? "yearly" : "monthly"
  )
  const [isLoading, setIsLoading] = useState(false)

  const currentPlan = plans[selectedPlan]

  const handleSubscribe = async () => {
    setIsLoading(true)
    // TODO: Integrate with payment gateway
    // For now, just simulate
    setTimeout(() => {
      setIsLoading(false)
      alert("سيتم تفعيل بوابة الدفع قريباً!")
    }, 1000)
  }

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
            <Crown className="h-3 w-3 ml-1" />
            اشتراك بريميوم
          </Badge>
          <h1 className="text-4xl font-bold mb-4">احصل على وصول غير محدود</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            اشترك الآن واحصل على وصول لجميع الكورسات والميزات الحصرية
          </p>
        </div>

        {/* Plan Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-muted rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`px-6 py-2 rounded-md transition-all ${
                selectedPlan === "monthly"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              شهري
            </button>
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={`px-6 py-2 rounded-md transition-all flex items-center gap-2 ${
                selectedPlan === "yearly"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              سنوي
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 text-xs"
              >
                وفر 33%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Card */}
        <Card className="max-w-lg mx-auto border-2 border-primary shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">
              اشتراك {selectedPlan === "monthly" ? "شهري" : "سنوي"}
            </CardTitle>
            <CardDescription>وصول كامل لجميع الميزات</CardDescription>
          </CardHeader>

          <CardContent className="text-center">
            {/* Price */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-5xl font-bold">{currentPlan.price}</span>
                <div className="text-right">
                  <div className="text-lg font-medium">ج.م</div>
                  <div className="text-sm text-muted-foreground">
                    /{currentPlan.period}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="line-through">
                  {currentPlan.originalPrice} ج.م
                </span>
                <Badge variant="destructive" className="text-xs">
                  خصم {currentPlan.discount}%
                </Badge>
              </div>
              {selectedPlan === "yearly" && (
                <p className="text-sm text-green-600 mt-2">
                  توفير {plans.yearly.savings} ج.م سنوياً!
                </p>
              )}
            </div>

            {/* Features */}
            <div className="text-right space-y-3 mb-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button
              className="w-full h-12 text-lg gap-2"
              size="lg"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? (
                "جاري المعالجة..."
              ) : (
                <>
                  اشترك الآن
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>ضمان استرداد الأموال خلال 7 أيام</span>
            </div>
          </CardFooter>
        </Card>

        {/* FAQ or Trust Badges */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            يثق بنا أكثر من 10,000+ طالب
          </p>
          <div className="flex justify-center gap-8 text-muted-foreground">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">100+</div>
              <div className="text-sm">كورس</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">50+</div>
              <div className="text-sm">معلم خبير</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">4.8</div>
              <div className="text-sm">تقييم</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
