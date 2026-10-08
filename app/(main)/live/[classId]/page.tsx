import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { LiveRoom } from "@/components/live/live-room"

interface LivePageProps {
  params: {
    classId: string
  }
}

export async function generateMetadata({ params }: LivePageProps) {
  const t = await getTranslations("live")
  const locale = await getLocale()
  return {
    title: t("liveClass"),
  }
}

export default async function LivePage({ params }: LivePageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect(`/login?callbackUrl=/live/${params.classId}`)
  }

  const liveClass = await db.liveClass.findUnique({
    where: { id: params.classId },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
        },
      },
      course: {
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
        },
      },
    },
  })

  if (!liveClass) {
    redirect("/")
  }

  const isHost = liveClass.instructorId === session.user.id

  // Check enrollment if course-specific and not host
  if (liveClass.courseId && !isHost && session.user.role !== "ADMIN") {
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: liveClass.courseId,
        },
      },
    })

    if (!enrollment) {
      redirect(`/courses/${liveClass.course?.slug}`)
    }
  }

  // If not live yet and not host, show waiting page
  if (liveClass.status === "SCHEDULED" && !isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {locale === "en" ? liveClass.title : liveClass.titleAr || liveClass.title}
          </h1>
          <p className="text-muted-foreground mb-6">{t("notStartedYet")}</p>
          <p className="text-sm">
            {t("scheduledFor")}:{" "}
            {new Date(liveClass.scheduledAt).toLocaleString(locale === "en" ? "en-US" : "ar-EG")}
          </p>
        </div>
      </div>
    )
  }

  if (liveClass.status === "ENDED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {locale === "en" ? liveClass.title : liveClass.titleAr || liveClass.title}
          </h1>
          <p className="text-muted-foreground">{t("classHasEnded")}</p>
        </div>
      </div>
    )
  }

  return (
    <LiveRoom
      classId={params.classId}
      classTitle={liveClass.titleAr || liveClass.title}
      isHost={isHost}
    />
  )
}
