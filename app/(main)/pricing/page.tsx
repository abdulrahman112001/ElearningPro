import { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, Star, Zap, Crown, Sparkles } from "lucide-react"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pricing")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function PricingPage() {
  const t = await getTranslations("pricing")

  const plans = [
    {
      id: "free",
      name: t("freePlan"),
      description: t("freePlanDescription"),
      price: 0,
      priceLabel: t("free"),
      icon: Sparkles,
      popular: false,
      features: [
        { text: t("accessFreeCourses"), included: true },
        { text: t("communityAccess"), included: true },
        { text: t("basicSupport"), included: true },
        { text: t("certificate"), included: false },
        { text: t("downloadResources"), included: false },
        { text: t("prioritySupport"), included: false },
        { text: t("liveClasses"), included: false },
      ],
      cta: t("getStarted"),
      href: "/register",
    },
    {
      id: "monthly",
      name: t("monthlyPlan"),
      description: t("monthlyPlanDescription"),
      price: 99,
      priceLabel: `99 ${t("currency")}/${t("month")}`,
      icon: Star,
      popular: true,
      features: [
        { text: t("accessAllCourses"), included: true },
        { text: t("communityAccess"), included: true },
        { text: t("prioritySupport"), included: true },
        { text: t("certificate"), included: true },
        { text: t("downloadResources"), included: true },
        { text: t("liveClasses"), included: true },
        { text: t("monthlyWebinars"), included: false },
      ],
      cta: t("subscribe"),
      href: "/checkout/subscription?plan=monthly",
    },
    {
      id: "yearly",
      name: t("yearlyPlan"),
      description: t("yearlyPlanDescription"),
      price: 799,
      priceLabel: `799 ${t("currency")}/${t("year")}`,
      originalPrice: 1188,
      discount: "33%",
      icon: Zap,
      popular: false,
      features: [
        { text: t("accessAllCourses"), included: true },
        { text: t("communityAccess"), included: true },
        { text: t("prioritySupport"), included: true },
        { text: t("certificate"), included: true },
        { text: t("downloadResources"), included: true },
        { text: t("liveClasses"), included: true },
        { text: t("monthlyWebinars"), included: true },
      ],
      cta: t("subscribe"),
      href: "/checkout/subscription?plan=yearly",
    },
    {
      id: "lifetime",
      name: t("lifetimePlan"),
      description: t("lifetimePlanDescription"),
      price: 2999,
      priceLabel: `2999 ${t("currency")}`,
      icon: Crown,
      popular: false,
      features: [
        { text: t("accessAllCourses"), included: true },
        { text: t("communityAccess"), included: true },
        { text: t("vipSupport"), included: true },
        { text: t("certificate"), included: true },
        { text: t("downloadResources"), included: true },
        { text: t("liveClasses"), included: true },
        { text: t("monthlyWebinars"), included: true },
        { text: t("oneOnOneSessions"), included: true },
      ],
      cta: t("getLifetime"),
      href: "/checkout/subscription?plan=lifetime",
    },
  ]

  const faqs = [
    { q: t("faq1Question"), a: t("faq1Answer") },
    { q: t("faq2Question"), a: t("faq2Answer") },
    { q: t("faq3Question"), a: t("faq3Answer") },
    { q: t("faq4Question"), a: t("faq4Answer") },
  ]

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("description")}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => {
            const Icon = plan.icon
            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden ${
                  plan.popular
                    ? "border-primary shadow-lg scale-105"
                    : "hover:shadow-md"
                } transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute top-0 start-0 end-0 bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                    {t("mostPopular")}
                  </div>
                )}

                <CardHeader className={plan.popular ? "pt-10" : ""}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div className="text-center py-4 border-y">
                    {plan.discount && (
                      <Badge className="mb-2 bg-green-500">
                        {t("save")} {plan.discount}
                      </Badge>
                    )}
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground">
                          {t("currency")}
                        </span>
                      )}
                    </div>
                    {plan.originalPrice && (
                      <p className="text-sm text-muted-foreground line-through">
                        {plan.originalPrice} {t("currency")}
                      </p>
                    )}
                    {plan.price === 0 && (
                      <p className="text-lg font-semibold text-green-600">
                        {t("free")}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={
                            feature.included ? "" : "text-muted-foreground"
                          }
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            {t("faqTitle")}
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-16 p-8 bg-muted/50 rounded-2xl">
          <h3 className="text-2xl font-bold mb-4">{t("needHelp")}</h3>
          <p className="text-muted-foreground mb-6">
            {t("contactDescription")}
          </p>
          <Button asChild size="lg">
            <Link href="/contact">{t("contactUs")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
