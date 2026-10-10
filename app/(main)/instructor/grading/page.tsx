import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { ListSkeleton } from "@/components/shared"
import { GradingInbox } from "@/components/exams/grading-inbox"

export async function generateMetadata() {
  const t = await getTranslations("exams")
  return { title: t("grading.title") }
}

export default function InstructorGradingPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} withAction />}>
      <GradingInbox />
    </Suspense>
  )
}
