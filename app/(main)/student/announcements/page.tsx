import { getLocale, getTranslations } from "next-intl/server"
import { Megaphone, Pin } from "lucide-react"
import { auth } from "@/lib/auth"
import { announcementsForStudent } from "@/lib/school"
import { AvatarName, EmptyState, PageHeader } from "@/components/shared"
import { intlLocale } from "@/components/school/format"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("school")
  return { title: t("announcements.myTitle") }
}

export default async function StudentAnnouncementsPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  const t = await getTranslations("school")
  const locale = await getLocale()
  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })
  const rows = await announcementsForStudent(session.user.id)

  return (
    <div className="space-y-6">
      <PageHeader icon={Megaphone} title={t("announcements.myTitle")} description={t("announcements.studentSubtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("announcements.emptyStudent")} />
      ) : (
        <ul className="space-y-4">
          {rows.map((a) => (
            <li key={a.id} className={cn("rounded-lg border bg-card p-4 shadow-soft sm:p-5", a.pinned && "border-primary/40")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 break-words font-semibold">
                    {a.pinned && <Pin className="h-4 w-4 shrink-0 text-primary" aria-label={t("announcements.pinned")} />}
                    {a.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {[a.organization?.name, a.group?.name ?? t("announcements.wholeSchool")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={a.createdAt.toISOString()}>
                  {dateFmt.format(a.createdAt)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{a.body}</p>
              <AvatarName name={a.author.name} image={a.author.image} size="sm" className="mt-4" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
