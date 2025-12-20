import { notFound } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { format } from "date-fns"
import { CheckCircle, XCircle, ExternalLink, Award } from "lucide-react"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface VerifyPageProps {
  params: {
    certificateNo: string
  }
}

export async function generateMetadata() {
  const t = await getTranslations("certificate")
  return {
    title: t("verifyCertificate"),
  }
}

export default async function VerifyCertificatePage({
  params,
}: VerifyPageProps) {
  const t = await getTranslations("certificate")

  const certificate = await db.certificate.findUnique({
    where: { certificateNo: params.certificateNo },
    include: {
      course: {
        select: {
          title: true,
          titleAr: true,
          slug: true,
          instructor: {
            select: {
              name: true,
            },
          },
        },
      },
      user: {
        select: {
          name: true,
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
              certificate
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {certificate ? (
              <CheckCircle className="h-8 w-8" />
            ) : (
              <XCircle className="h-8 w-8" />
            )}
          </div>
          <CardTitle>
            {certificate ? t("validCertificate") : t("invalidCertificate")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certificate ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">{t("certificateDetails")}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t("holder")}</p>
                    <p className="font-medium">{certificate.user.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("course")}</p>
                    <p className="font-medium">{certificate.course.titleEn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("instructor")}</p>
                    <p className="font-medium">
                      {certificate.course.instructor.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("issuedOn")}</p>
                    <p className="font-medium">
                      {format(certificate.issuedAt, "PPP")}
                    </p>
                  </div>
                  {certificate.grade !== null && (
                    <div>
                      <p className="text-muted-foreground">{t("grade")}</p>
                      <p className="font-medium">
                        {Math.round(certificate.grade)}%
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">
                      {t("certificateNo")}
                    </p>
                    <p className="font-mono text-xs">
                      {certificate.certificateNo}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle className="me-1 h-3 w-3" />
                  {t("verifiedAuthentic")}
                </Badge>
              </div>

              <Button asChild className="w-full">
                <Link href={`/courses/${certificate.course.slug}`}>
                  {t("viewCourse")}
                  <ExternalLink className="ms-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {t("certificateNotFoundMessage")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("searchedFor")}:{" "}
                <code className="bg-muted px-2 py-1 rounded">
                  {params.certificateNo}
                </code>
              </p>
              <Button asChild variant="outline">
                <Link href="/">{t("backToHome")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
