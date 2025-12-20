import { redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Award, Download, ExternalLink, Calendar, BookOpen } from "lucide-react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"

export async function generateMetadata() {
  const t = await getTranslations("student")
  return {
    title: t("certificates"),
  }
}

export default async function StudentCertificatesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const t = await getTranslations("student")
  const tCert = await getTranslations("certificate")

  // Get user's certificates
  const certificates = await db.certificate.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        select: {
          id: true,
          titleEn: true,
          titleAr: true,
          slug: true,
          thumbnail: true,
          instructor: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  })

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8 text-yellow-500" />
            {t("certificates")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("certificatesDescription")}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {certificates.length} {t("certificatesCount")}
        </Badge>
      </div>

      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Award className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {t("noCertificates")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("noCertificatesDescription")}
            </p>
            <Button asChild>
              <Link href="/student/courses">{t("continueLearning")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate) => (
            <Card
              key={certificate.id}
              className="overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="bg-gradient-to-br from-yellow-500/20 via-yellow-400/10 to-transparent p-6">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <Award className="h-20 w-20 text-yellow-500" />
                    <div className="absolute -bottom-1 -end-1 bg-green-500 rounded-full p-1">
                      <svg
                        className="h-4 w-4 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-4">
                <div className="text-center mb-4">
                  <h3 className="font-bold text-lg mb-1">
                    {tCert("certificateOfCompletion")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {certificate.course.titleAr || certificate.course.titleEn}
                  </p>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {tCert("issuedOn")}
                    </span>
                    <span className="font-medium">
                      {format(new Date(certificate.issuedAt), "dd MMMM yyyy", {
                        locale: ar,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {tCert("certificateNo")}
                    </span>
                    <span className="font-mono text-xs">
                      {certificate.certificateNo}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("instructor")}
                    </span>
                    <span className="font-medium">
                      {certificate.course.instructor.name}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={`/certificates/${certificate.certificateNo}`}>
                      <ExternalLink className="h-4 w-4 ms-1" />
                      {t("view")}
                    </Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={`/api/certificates/${certificate.id}/download`}>
                      <Download className="h-4 w-4 ms-1" />
                      {tCert("downloadCertificate")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
