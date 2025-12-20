import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("analytics"),
  }
}

export default async function AdminAnalyticsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("admin")

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("analytics")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("analyticsDescription")}
        </p>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
