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
import toast from "react-hot-toast"

const plans = {
  monthly: {
    id: "monthly",
    price: 99,
    originalPrice: 149,
    discount: 33,
  },
  yearly: {
    id: "yearly",
    price: 799,
    originalPrice: 1188,
    discount: 33,
    savings: 389,
  },
}

const features = [
  "unlimitedAccess",
  "certificates",
  "support",
  "offlineDownload",
  "earlyAccess",
  "exclusiveDiscounts",
  "community",
  "expertSessions",
] as const

export default function SubscriptionPage() {
  const t = useTranslations("subscriptionCheckout")
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
      toast(t("comingSoon"))
    }, 1000)
  }

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
            <Crown className="h-3 w-3 ms-1" />
            {t("badge")}
          </Badge>
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
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
              {t("monthly")}
            </button>
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={`px-6 py-2 rounded-md transition-all flex items-center gap-2 ${
                selectedPlan === "yearly"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("yearly")}
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 text-xs"
              >
                {t("save", { percent: 33 })}
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
              {t(selectedPlan === "monthly" ? "monthlyPlan" : "yearlyPlan")}
            </CardTitle>
            <CardDescription>{t("fullAccess")}</CardDescription>
          </CardHeader>

          <CardContent className="text-center">
            {/* Price */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-5xl font-bold">{currentPlan.price}</span>
                <div className="text-end">
                  <div className="text-lg font-medium">{t("currency")}</div>
                  <div className="text-sm text-muted-foreground">
                    /{t(selectedPlan === "monthly" ? "perMonth" : "perYear")}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <span className="line-through">
                  {currentPlan.originalPrice} {t("currency")}
                </span>
                <Badge variant="destructive" className="text-xs">
                  {t("discount", { percent: currentPlan.discount })}
                </Badge>
              </div>
              {selectedPlan === "yearly" && (
                <p className="text-sm text-green-600 mt-2">
                  {t("yearlySavings", { amount: plans.yearly.savings })}
                </p>
              )}
            </div>

            {/* Features */}
            <div className="text-end space-y-3 mb-6">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm">{t(`features.${feature}`)}</span>
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
                t("processing")
              ) : (
                <>
                  {t("subscribeNow")}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>{t("moneyBack")}</span>
            </div>
          </CardFooter>
        </Card>

        {/* FAQ or Trust Badges */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            {t("trustedBy")}
          </p>
          <div className="flex justify-center gap-8 text-muted-foreground">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">100+</div>
              <div className="text-sm">{t("stats.courses")}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">50+</div>
              <div className="text-sm">{t("stats.instructors")}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">4.8</div>
              <div className="text-sm">{t("stats.rating")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
