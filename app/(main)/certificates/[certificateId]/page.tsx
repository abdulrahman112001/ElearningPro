import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { CertificateView } from "@/components/certificate/certificate-view"

interface CertificatePageProps {
  params: {
    certificateId: string
  }
}

export async function generateMetadata({ params }: CertificatePageProps) {
  const t = await getTranslations("certificate")
  return {
    title: t("myCertificate"),
  }
}

export default async function CertificatePage({
  params,
}: CertificatePageProps) {
  const certificate = await db.certificate.findFirst({
    where: {
      OR: [
        { id: params.certificateId },
        { certificateNo: params.certificateId },
      ],
    },
    include: {
      course: {
        select: {
          titleEn: true,
          titleAr: true,
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

  if (!certificate) {
    notFound()
  }

  return (
    <div className="container py-8">
      <CertificateView
        certificate={{
          ...certificate,
          issuedAt: certificate.issuedAt.toISOString(),
          completedAt: certificate.completedAt.toISOString(),
        }}
      />
    </div>
  )
}
