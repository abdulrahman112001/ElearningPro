import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Building2 } from "lucide-react"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { EmptyState, PageHeader } from "@/components/shared"
import { OrgForm } from "@/components/organizations/org-form"

export async function generateMetadata() {
  const t = await getTranslations("organizations")
  return { title: t("create.title") }
}

export default async function NewOrganizationPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/org/new")
  const t = await getTranslations("organizations")
  const allowed =
    session.user.role === "ADMIN" || (session.user.role === "INSTRUCTOR" && session.user.instructorApproved)

  return (
    <div className="container max-w-3xl px-4 py-8">
      <PageHeader
        icon={Building2}
        title={t("create.title")}
        description={t("create.subtitle")}
        breadcrumbs={[{ label: t("mine.title"), href: "/org" }, { label: t("create.title") }]}
      />
      {allowed ? (
        <OrgForm />
      ) : (
        <EmptyState
          icon={Building2}
          title={t("create.notAllowed")}
          description={t("create.notAllowedHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/instructor-application">{t("create.becomeTeacher")}</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
