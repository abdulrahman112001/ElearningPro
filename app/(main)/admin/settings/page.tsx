import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { SettingsForm } from "@/components/admin/settings-form"

export async function generateMetadata() {
  const t = await getTranslations("admin")
  return {
    title: t("settings"),
  }
}

const DEFAULT_SETTINGS = {
  siteName: "LearnHub",
  siteDescription: "Learn anything, anytime, anywhere",
  platformFee: 30,
  minWithdrawal: 50,
  currency: "USD",
  supportEmail: "support@learnhub.com",
  allowRegistration: true,
  requireEmailVerification: true,
  maintenanceMode: false,
  paymentGateways: {
    stripe: { enabled: true },
    paypal: { enabled: true },
    paymob: { enabled: false },
    tap: { enabled: false },
  },
}

export default async function AdminSettingsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("admin")

  // Fetch settings from database
  const settingsRecords = await db.setting.findMany()

  // Merge with defaults
  const settings = { ...DEFAULT_SETTINGS }

  for (const record of settingsRecords) {
    try {
      ;(settings as Record<string, unknown>)[record.key] = JSON.parse(
        record.value
      )
    } catch {
      ;(settings as Record<string, unknown>)[record.key] = record.value
    }
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("settings")}</h1>
        <p className="text-muted-foreground mt-1">{t("platformSettings")}</p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  )
}
