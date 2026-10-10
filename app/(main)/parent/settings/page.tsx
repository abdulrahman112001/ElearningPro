import { getTranslations } from "next-intl/server"
import { Settings } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getReportOptOuts, reportOptOutKey } from "@/lib/reports/parent-links"
import { PageHeader } from "@/components/shared"
import { ParentSettingsForm } from "@/components/parent/parent-settings-form"

export async function generateMetadata() {
  const t = await getTranslations("parent.settings")
  return { title: t("title") }
}

export default async function ParentSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("parent.settings")
  const userId = session.user.id
  const [user, off] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true, email: true, phone: true, preferredLanguage: true },
    }),
    getReportOptOuts([userId]),
  ])

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader icon={Settings} title={t("title")} description={t("description")} />
      <ParentSettingsForm
        initial={{
          name: user.name ?? "",
          email: user.email,
          phone: user.phone ?? "",
          preferredLanguage: user.preferredLanguage === "en" ? "en" : "ar",
          whatsappReports: !off.has(reportOptOutKey("whatsapp", userId)),
          emailReports: !off.has(reportOptOutKey("email", userId)),
        }}
      />
    </div>
  )
}
