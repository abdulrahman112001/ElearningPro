import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { GraduationCap, RefreshCw, WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

/**
 * Shown by the service worker when a page is requested without a network
 * connection. Precached at install, so it must not depend on the session.
 */
export default async function OfflinePage() {
  const t = await getTranslations("pwa")
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 shadow-lg shadow-primary/30">
          <GraduationCap className="h-8 w-8 text-white" aria-hidden="true" />
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">{t("offlineTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("offlineDescription")}</p>
        <ul className="mx-auto mt-6 max-w-xs space-y-2 text-start text-sm text-muted-foreground">
          <li>• {t("offlineTip1")}</li>
          <li>• {t("offlineTip2")}</li>
        </ul>
        <a
          href="/"
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("offlineRetry")}
        </a>
      </div>
    </main>
  )
}
