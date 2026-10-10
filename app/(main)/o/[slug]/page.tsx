import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { cache } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import { BookOpen, Clock, Mail, MapPin, MessageCircle, Phone, Users, UsersRound, Wallet } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { normalizeEgyptianPhone } from "@/lib/whatsapp"
import { formatPrice } from "@/lib/utils"
import { AvatarName, EmptyState } from "@/components/shared"
import { OrgLogo } from "@/components/organizations/org-logo"
import { JoinButton } from "@/components/organizations/join-button"

const getOrg = cache(async (slug: string) => {
  if (!slug || slug.length > 60) return null
  const org = await db.organization.findUnique({ where: { slug: slug.toLowerCase() } })
  if (!org || !org.isApproved || !org.isActive) return null
  return org
})

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const org = await getOrg(params.slug)
  if (!org) return { title: "404" }
  const description = (org.description || org.name).slice(0, 160)
  return {
    title: org.name,
    description,
    openGraph: {
      title: org.name,
      description,
      type: "website",
      images: org.logoUrl ? [{ url: org.logoUrl }] : undefined,
    },
    alternates: { canonical: `/o/${org.slug}` },
  }
}

export default async function PublicOrgPage({ params }: { params: { slug: string } }) {
  const org = await getOrg(params.slug)
  if (!org) notFound()
  const t = await getTranslations("organizations")
  const locale = await getLocale()
  const session = await auth()
  const dayFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", { weekday: "short", timeZone: "UTC" })

  const [staff, courses, classes, studentCount, membership] = await Promise.all([
    db.organizationMember.findMany({
      where: { organizationId: org.id, role: { in: ["OWNER", "MANAGER", "TEACHER"] }, user: { role: "INSTRUCTOR" } },
      orderBy: { joinedAt: "asc" },
      select: { title: true, user: { select: { id: true, name: true, image: true, headline: true } } },
    }),
    db.course.findMany({
      where: { organizationId: org.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, slug: true, titleAr: true, titleEn: true, thumbnail: true, price: true, discountPrice: true, currency: true },
    }),
    db.classGroup.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, mode: true, monthlyFee: true, location: true, capacity: true,
        gradeLevel: { select: { nameAr: true, nameEn: true } },
        instructor: { select: { name: true } },
        scheduleSlots: { select: { dayOfWeek: true, startTime: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        _count: { select: { members: true } },
      },
    }),
    db.organizationMember.count({ where: { organizationId: org.id, role: "STUDENT" } }),
    session?.user
      ? db.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: org.id, userId: session.user.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])

  const viewer: "guest" | "student" | "member" | "other" = !session?.user
    ? "guest"
    : membership
      ? "member"
      : session.user.role === "STUDENT"
        ? "student"
        : "other"
  const color = org.primaryColor && /^#[0-9a-f]{6}$/i.test(org.primaryColor) ? org.primaryColor : "#4f46e5"
  const wa = normalizeEgyptianPhone(org.phone)
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")

  return (
    <div style={{ ["--org-primary" as string]: color }} className="pb-16">
      {/* Hero */}
      <section className="relative isolate overflow-hidden text-white" style={{ backgroundColor: "var(--org-primary)" }}>
        {org.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.coverUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
        <div className="container flex flex-col gap-6 px-4 py-12 sm:flex-row sm:items-end sm:py-16">
          <OrgLogo name={org.name} logoUrl={org.logoUrl} color={color} className="h-20 w-20 border-2 border-white/70 text-3xl shadow-lg sm:h-24 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium opacity-90">{t(`types.${org.type}`)}{org.governorate ? ` · ${org.governorate}` : ""}</p>
            <h1 className="break-words text-3xl font-bold sm:text-4xl">{org.name}</h1>
            <p className="text-sm opacity-90">
              {t("public.summary", { teachers: staff.length, students: studentCount, classes: classes.length })}
            </p>
          </div>
          <div className="shrink-0">
            <JoinButton orgId={org.id} slug={org.slug} viewer={viewer} />
          </div>
        </div>
      </section>

      <div className="container grid gap-8 px-4 pt-10 lg:grid-cols-3">
        <div className="min-w-0 space-y-10 lg:col-span-2">
          {org.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="mb-3 text-xl font-bold">{t("public.about")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{org.description}</p>
            </section>
          )}

          <section aria-labelledby="classes">
            <h2 id="classes" className="mb-4 flex items-center gap-2 text-xl font-bold">
              <UsersRound className="h-5 w-5" style={{ color: "var(--org-primary)" }} aria-hidden="true" />
              {t("public.classes")}
            </h2>
            {classes.length === 0 ? (
              <EmptyState size="sm" icon={UsersRound} title={t("classes.empty")} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {classes.map((c) => {
                  const grade = c.gradeLevel ? (locale === "ar" ? c.gradeLevel.nameAr : c.gradeLevel.nameEn) : null
                  const schedule = c.scheduleSlots
                    .map((s) => `${dayFmt.format(new Date(Date.UTC(2023, 0, 1 + s.dayOfWeek)))} ${s.startTime}`)
                    .join(" · ")
                  const full = c.capacity != null && c._count.members >= c.capacity
                  return (
                    <li key={c.id} className="min-w-0 rounded-lg border bg-card p-4" style={{ borderTop: "3px solid var(--org-primary)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{[grade, c.instructor.name].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{t(`modes.${c.mode}`)}</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {c.monthlyFee > 0 ? t("classes.perMonth", { fee: formatPrice(c.monthlyFee, "EGP", locale) }) : t("classes.free")}
                        </li>
                        {schedule && (
                          <li className="flex items-center gap-2">
                            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{schedule}</span>
                          </li>
                        )}
                        {c.location && (
                          <li className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{c.location}</span>
                          </li>
                        )}
                        {full && <li className="text-xs font-medium text-destructive">{t("errors.class_full")}</li>}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="courses">
            <h2 id="courses" className="mb-4 flex items-center gap-2 text-xl font-bold">
              <BookOpen className="h-5 w-5" style={{ color: "var(--org-primary)" }} aria-hidden="true" />
              {t("public.courses")}
            </h2>
            {courses.length === 0 ? (
              <EmptyState size="sm" icon={BookOpen} title={t("courses.empty")} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/courses/${c.slug}`} className="flex min-w-0 gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                      {c.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.thumbnail} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                          <BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium">{locale === "ar" ? c.titleAr || c.titleEn : c.titleEn || c.titleAr}</p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "var(--org-primary)" }}>
                          {formatPrice(c.discountPrice ?? c.price, c.currency, locale)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="contact" className="rounded-lg border bg-card p-5">
            <h2 id="contact" className="mb-3 font-bold">{t("public.contact")}</h2>
            <ul className="space-y-3 text-sm">
              {wa && (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    <MessageCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                    {t("public.whatsapp")}
                  </a>
                </li>
              )}
              {org.phone && (
                <li>
                  <a href={`tel:${org.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span dir="ltr">{org.phone}</span>
                  </a>
                </li>
              )}
              {org.email && (
                <li>
                  <a href={`mailto:${org.email}`} className="flex min-w-0 items-center gap-2 hover:underline">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span dir="ltr" className="truncate">{org.email}</span>
                  </a>
                </li>
              )}
              {(org.address || org.governorate) && (
                <li className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{[org.address, org.governorate].filter(Boolean).join("، ")}</span>
                </li>
              )}
              {!org.phone && !org.email && !org.address && !org.governorate && (
                <li className="text-muted-foreground">{t("public.noContact")}</li>
              )}
            </ul>
          </section>

          <section aria-labelledby="teachers" className="rounded-lg border bg-card p-5">
            <h2 id="teachers" className="mb-3 flex items-center gap-2 font-bold">
              <Users className="h-4 w-4" aria-hidden="true" />
              {t("public.teachers")} <span className="text-sm font-normal text-muted-foreground">({nf.format(staff.length)})</span>
            </h2>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("public.noTeachers")}</p>
            ) : (
              <ul className="space-y-3">
                {staff.map((m) => (
                  <li key={m.user.id}>
                    <Link href={`/instructors/${m.user.id}`} className="block rounded-md hover:bg-muted/50">
                      <AvatarName name={m.user.name} image={m.user.image} secondary={m.title || m.user.headline || undefined} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
