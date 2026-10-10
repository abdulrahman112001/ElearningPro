import { getLocale, getTranslations } from "next-intl/server"
import { HeartHandshake, KeyRound, UserMinus, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureParentLinkCode } from "@/lib/reports/parent-links"
import { AvatarName, EmptyState, PageHeader, SectionCard } from "@/components/shared"
import { FamilyCodeCard } from "@/components/parent/family-code-card"
import { ConfirmActionButton } from "@/components/parent/confirm-action-button"

export async function generateMetadata() {
  const t = await getTranslations("parent.family")
  return { title: t("title") }
}

export default async function StudentFamilyPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("parent.family")
  const tr = await getTranslations("parent.relations")

  if (session.user.role !== "STUDENT") {
    return (
      <div>
        <PageHeader icon={HeartHandshake} title={t("title")} description={t("description")} />
        <EmptyState icon={Users} title={t("studentsOnly")} />
      </div>
    )
  }

  const locale = await getLocale()
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" })
  const [code, links] = await Promise.all([
    ensureParentLinkCode(session.user.id),
    db.parentLink.findMany({
      where: { studentId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        relation: true,
        createdAt: true,
        parent: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader icon={HeartHandshake} title={t("title")} description={t("description")} />

      <SectionCard icon={KeyRound} title={t("codeTitle")} description={t("codeDescription")}>
        <FamilyCodeCard initialCode={code} />
      </SectionCard>

      <SectionCard
        icon={Users}
        title={t("parentsTitle")}
        description={t("parentsDescription", { count: links.length, max: 4 })}
        contentClassName={links.length ? "p-0" : undefined}
      >
        {links.length === 0 ? (
          <EmptyState variant="plain" size="sm" icon={Users} title={t("noParents")} description={t("noParentsDescription")} />
        ) : (
          <ul className="divide-y">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <AvatarName
                  name={l.parent.name}
                  image={l.parent.image}
                  secondary={[l.relation ? tr(l.relation as "father") : null, t("linkedOn", { date: dateFmt.format(l.createdAt) })]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <ConfirmActionButton
                  url={`/api/student/parents?parentId=${l.parent.id}`}
                  label={t("remove")}
                  icon={<UserMinus aria-hidden="true" />}
                  title={t("removeTitle")}
                  description={t("removeDescription", { name: l.parent.name ?? "" })}
                  confirmLabel={t("remove")}
                  successMessage={t("removed")}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
