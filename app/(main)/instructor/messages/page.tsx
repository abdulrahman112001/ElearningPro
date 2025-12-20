import { auth } from "@/lib/auth"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { MessagesInterface } from "@/components/messages/messages-interface"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("messages"),
  }
}

export default async function InstructorMessagesPage() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("messages")}</h1>
        <p className="text-muted-foreground">
          {t("messagesDescription") || "تواصل مع طلابك"}
        </p>
      </div>

      {/* Messages Interface */}
      <MessagesInterface />
    </div>
  )
}
