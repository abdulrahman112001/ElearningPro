import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared"
import { OrgLogo } from "@/components/organizations/org-logo"
import { AcceptInviteButton } from "@/components/organizations/accept-invite"

export async function generateMetadata() {
  const t = await getTranslations("organizations")
  return { title: t("acceptInvite.title"), robots: { index: false } }
}

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const t = await getTranslations("organizations")
  const session = await auth()
  const invite =
    params.token.length <= 100
      ? await db.organizationInvite.findUnique({
          where: { token: params.token },
          include: { organization: { select: { id: true, name: true, type: true, logoUrl: true, primaryColor: true, isActive: true } } },
        })
      : null

  const wrap = (children: React.ReactNode) => <div className="container max-w-lg px-4 py-12">{children}</div>

  if (!invite) {
    return wrap(<EmptyState icon={AlertTriangle} title={t("acceptInvite.notFound")} />)
  }
  if (invite.acceptedAt) {
    return wrap(
      <EmptyState
        icon={AlertTriangle}
        title={t("errors.invite_used")}
        action={<Button asChild variant="outline"><Link href="/org">{t("mine.title")}</Link></Button>}
      />
    )
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    return wrap(<EmptyState icon={AlertTriangle} title={t("errors.invite_expired")} description={t("acceptInvite.askAgain")} />)
  }

  const callback = encodeURIComponent(`/org/invite/${params.token}`)
  const signedInEmail = session?.user?.email?.toLowerCase()
  const wrongEmail = !!signedInEmail && signedInEmail !== invite.email.toLowerCase()

  return wrap(
    <div className="space-y-6 rounded-xl border bg-card p-6 text-center shadow-sm">
      <div className="flex justify-center">
        <OrgLogo name={invite.organization.name} logoUrl={invite.organization.logoUrl} color={invite.organization.primaryColor} className="h-16 w-16" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold">{t("acceptInvite.heading", { name: invite.organization.name })}</h1>
        <p className="text-sm text-muted-foreground">
          {t("acceptInvite.as", { role: t(`roles.${invite.role}`), type: t(`types.${invite.organization.type}`) })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("acceptInvite.sentTo")} <span dir="ltr" className="font-medium">{invite.email}</span>
        </p>
      </div>
      {!session?.user ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1"><Link href={`/login?callbackUrl=${callback}`}>{t("acceptInvite.login")}</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link href={`/register?callbackUrl=${callback}`}>{t("acceptInvite.register")}</Link></Button>
        </div>
      ) : wrongEmail ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-start text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t("errors.email_mismatch")}</p>
        </div>
      ) : (

          <AcceptInviteButton token={params.token} />

      )}
    </div>
  )
}
