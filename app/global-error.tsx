"use client"

import { useEffect, useState } from "react"
import "./globals.css"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [isRTL, setIsRTL] = useState(true)

  useEffect(() => {
    console.error(error)
    const cookieLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith("locale="))
      ?.split("=")[1]
    setIsRTL(cookieLocale !== "en")
  }, [error])

  return (
    <html lang={isRTL ? "ar" : "en"} dir={isRTL ? "rtl" : "ltr"}>
      <body className="antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-2xl font-bold">
              {isRTL ? "حدث خطأ غير متوقع" : "Something went wrong"}
            </h1>
            <div className="flex gap-3">
              <button
                onClick={() => reset()}
                className="rounded-md bg-primary px-6 py-2 text-primary-foreground shadow hover:bg-primary/90"
              >
                {isRTL ? "يرجى المحاولة مرة أخرى" : "Please try again"}
              </button>
              <a
                href="/"
                className="rounded-md border border-input bg-background px-6 py-2 shadow-sm hover:bg-accent"
              >
                {isRTL ? "الرئيسية" : "Home"}
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
