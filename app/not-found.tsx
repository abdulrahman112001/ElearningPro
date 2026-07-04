"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  const t = useTranslations("errors")
  const tNav = useTranslations("navigation")

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <FileQuestion className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("pageNotFound")}</h1>
        <Button asChild size="lg">
          <Link href="/">{tNav("home")}</Link>
        </Button>
      </div>
    </div>
  )
}
