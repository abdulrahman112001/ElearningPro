import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { CheckinClient } from "@/components/attendance/checkin-client"

export async function generateMetadata() {
  const t = await getTranslations("attendance.checkin")
  return { title: t("title") }
}

export default async function CheckinPage({ searchParams }: { searchParams: { t?: string } }) {
  const token = typeof searchParams.t === "string" ? searchParams.t.slice(0, 100) : ""
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/checkin?t=${encodeURIComponent(token)}`)}`)
  }
  return (
    <div className="container flex min-h-[60vh] items-center justify-center px-4 py-10">
      <CheckinClient token={token} />
    </div>
  )
}
