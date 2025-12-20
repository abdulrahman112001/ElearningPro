"use client"

import { useRef } from "react"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { Download, Share2, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import toast from "react-hot-toast"

interface CertificateViewProps {
  certificate: {
    certificateNo: string
    issuedAt: string
    completedAt: string
    grade: number | null
    user: {
      name: string | null
    }
    course: {
      titleEn: string
      titleAr: string | null
      instructor: {
        name: string | null
      }
    }
  }
}

export function CertificateView({ certificate }: CertificateViewProps) {
  const t = useTranslations("certificate")
  const locale = useLocale()
  const certificateRef = useRef<HTMLDivElement>(null)
  const dateLocale = locale === "ar" ? ar : enUS

  const courseTitle =
    locale === "ar" && certificate.course.titleAr
      ? certificate.course.titleAr
      : certificate.course.titleEn

  const handleDownload = async () => {
    // In production, this would call an API to generate PDF
    toast.success(t("downloadStarted"))
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/verify/${certificate.certificateNo}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("shareTitle"),
          text: t("shareText", { course: courseTitle }),
          url,
        })
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url)
      toast.success(t("linkCopied"))
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button onClick={handleDownload}>
          <Download className="me-2 h-4 w-4" />
          {t("download")}
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="me-2 h-4 w-4" />
          {t("share")}
        </Button>
      </div>

      {/* Certificate */}
      <Card className="max-w-4xl mx-auto overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={certificateRef}
            className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50 p-12 border-8 border-double border-amber-200"
            style={{ aspectRatio: "1.414" }}
          >
            {/* Decorative corners */}
            <div className="absolute top-4 start-4 w-16 h-16 border-t-4 border-l-4 border-amber-400" />
            <div className="absolute top-4 end-4 w-16 h-16 border-t-4 border-r-4 border-amber-400" />
            <div className="absolute bottom-4 start-4 w-16 h-16 border-b-4 border-l-4 border-amber-400" />
            <div className="absolute bottom-4 end-4 w-16 h-16 border-b-4 border-r-4 border-amber-400" />

            <div className="text-center space-y-6 py-8">
              {/* Logo/Award Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <Award className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Title */}
              <div>
                <h1 className="text-4xl font-serif font-bold text-amber-800 mb-2">
                  {t("certificateOfCompletion")}
                </h1>
                <div className="w-48 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto" />
              </div>

              {/* Recipient */}
              <div className="py-6">
                <p className="text-gray-600 mb-2">{t("certifyThat")}</p>
                <h2 className="text-3xl font-serif font-bold text-gray-800 border-b-2 border-amber-300 inline-block px-8 py-2">
                  {certificate.user.name}
                </h2>
              </div>

              {/* Achievement */}
              <div>
                <p className="text-gray-600 mb-2">{t("hasCompleted")}</p>
                <h3 className="text-2xl font-semibold text-amber-800 max-w-lg mx-auto">
                  {courseTitle}
                </h3>
              </div>

              {/* Grade */}
              {certificate.grade !== null && (
                <div className="inline-block bg-amber-100 rounded-lg px-6 py-3">
                  <p className="text-sm text-gray-600">{t("grade")}</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {Math.round(certificate.grade)}%
                  </p>
                </div>
              )}

              {/* Date and Instructor */}
              <div className="grid grid-cols-2 gap-8 max-w-xl mx-auto pt-8">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{t("issuedOn")}</p>
                  <p className="font-semibold">
                    {format(new Date(certificate.issuedAt), "PPP", {
                      locale: dateLocale,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    {t("instructor")}
                  </p>
                  <p className="font-semibold">
                    {certificate.course.instructor.name}
                  </p>
                </div>
              </div>

              {/* Certificate Number */}
              <div className="pt-8 text-sm text-gray-500">
                <p>
                  {t("certificateNo")}: {certificate.certificateNo}
                </p>
                <p className="text-xs mt-1">
                  {t("verifyAt")}:{" "}
                  {typeof window !== "undefined" && window.location.origin}
                  /verify/{certificate.certificateNo}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
