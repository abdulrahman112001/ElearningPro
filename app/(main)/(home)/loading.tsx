// Kept inside a route group on purpose: a loading.tsx above a dynamic page
// (e.g. /courses/[slug]) streams the response, so notFound() there would be
// sent with HTTP 200 instead of 404.
import { Loader2 } from "lucide-react"
import { getTranslations } from "next-intl/server"

export default async function Loading() {
  const t = await getTranslations("common")
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">{t("loading")}</p>
      </div>
    </div>
  )
}
