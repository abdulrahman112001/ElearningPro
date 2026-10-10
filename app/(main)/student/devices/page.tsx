import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { Info, Laptop, MonitorSmartphone, Smartphone } from "lucide-react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { EmptyState, PageHeader, SectionCard } from "@/components/shared"
import { DEVICE_COOKIE, getSecuritySettings } from "@/lib/video-protection"

export const dynamic = "force-dynamic"

export async function generateMetadata() {
  const t = await getTranslations("videoProtection")
  return { title: t("devicesTitle") }
}

export default async function StudentDevicesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/student/devices")

  const t = await getTranslations("videoProtection")
  const locale = await getLocale()
  const currentDeviceId = cookies().get(DEVICE_COOKIE)?.value

  const [devices, settings] = await Promise.all([
    db.userDevice.findMany({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, deviceId: true, label: true, firstSeenAt: true, lastSeenAt: true },
    }),
    getSecuritySettings(),
  ])

  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US")
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <div className="space-y-6">
      <PageHeader icon={MonitorSmartphone} title={t("devicesTitle")} description={t("devicesSubtitle")} />

      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {settings.maxDevices > 0
              ? t("devicesUsage", {
                  used: nf.format(devices.length),
                  max: nf.format(settings.maxDevices),
                })
              : t("devicesUnlimited")}
          </p>
          <p>{t("devicesResetHint")}</p>
        </div>
      </div>

      <SectionCard icon={Laptop} title={t("myDevices")} contentClassName="p-0">
        {devices.length === 0 ? (
          <EmptyState variant="plain" icon={MonitorSmartphone} title={t("noDevices")} description={t("noDevicesHint")} />
        ) : (
          <ul className="divide-y">
            {devices.map((d) => {
              const current = d.deviceId === currentDeviceId
              const mobile = /Android|iOS/.test(d.label || "")
              const Icon = mobile ? Smartphone : Laptop
              return (
                <li
                  key={d.id}
                  className={current ? "flex items-center gap-3 bg-primary/5 px-4 py-3 sm:px-6" : "flex items-center gap-3 px-4 py-3 sm:px-6"}
                  data-testid="device-row"
                  data-current={current ? "true" : undefined}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium" dir="ltr">
                        {d.label || t("unknownDevice")}
                      </span>
                      {current && <Badge variant="secondary">{t("thisDevice")}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("lastSeen", { date: dateFmt.format(d.lastSeenAt) })}
                      <span className="mx-1">·</span>
                      {t("firstSeen", { date: dateFmt.format(d.firstSeenAt) })}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
