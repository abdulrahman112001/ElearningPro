import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { InstructorApplicationForm } from "@/components/instructor/application-form"

export async function generateMetadata() {
  const t = await getTranslations("instructorApplication")
  return { title: t("metaTitle") }
}

export default async function InstructorApplicationPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/instructor-application")
  }
  if (session.user.role !== "INSTRUCTOR") {
    redirect("/")
  }
  if (session.user.instructorApproved) {
    redirect("/instructor")
  }

  return (
    <div className="bg-gradient-to-b from-primary/5 via-transparent to-transparent">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <InstructorApplicationForm />
      </div>
    </div>
  )
}
