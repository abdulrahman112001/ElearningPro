"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors")
  const tNav = useTranslations("navigation")

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">{t("somethingWentWrong")}</h1>
        <div className="flex gap-3">
          <Button onClick={() => reset()} size="lg">
            {t("tryAgain")}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">{tNav("home")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
