import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Plus, Video, Calendar, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LiveClassCard } from "@/components/live/live-class-card"
import { ScheduleLiveClassDialog } from "@/components/live/schedule-live-class-dialog"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("liveClasses"),
  }
}

export default async function InstructorLiveClassesPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  const t = await getTranslations("live")

  // Get instructor's courses for the dropdown
  const courses = await db.course.findMany({
    where: { instructorId: session.user.id },
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Get all live classes
  const liveClasses = await db.liveClass.findMany({
    where: { instructorId: session.user.id },
    orderBy: { scheduledAt: "desc" },
    include: {
      course: {
        select: {
          titleEn: true,
          titleAr: true,
          slug: true,
        },
      },
      _count: {
        select: {
          attendees: true,
        },
      },
    },
  })

  const now = new Date()
  const liveNow = liveClasses.filter((c) => c.status === "LIVE")
  const upcoming = liveClasses.filter(
    (c) => c.status === "SCHEDULED" && new Date(c.scheduledAt) >= now
  )
  const past = liveClasses.filter(
    (c) =>
      c.status === "ENDED" ||
      (c.status === "SCHEDULED" && new Date(c.scheduledAt) < now)
  )

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("liveClasses")}</h1>
          <p className="text-muted-foreground mt-1">{t("manageLiveClasses")}</p>
        </div>

        <ScheduleLiveClassDialog
          courses={courses}
          trigger={
            <Button>
              <Plus className="me-2 h-4 w-4" />
              {t("scheduleClass")}
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="live" className="gap-2">
            <Radio className="h-4 w-4" />
            {t("liveNow")} {liveNow.length > 0 && `(${liveNow.length})`}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" />
            {t("upcoming")} ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2">
            <Video className="h-4 w-4" />
            {t("past")} ({past.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          {liveNow.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("noLiveNow")}</h3>
              <p className="text-muted-foreground mb-6">
                {t("noLiveNowDescription")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {liveNow.map((liveClass) => (
                <LiveClassCard
                  key={liveClass.id}
                  liveClass={liveClass}
                  isInstructor
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("noUpcomingClasses")}
              </h3>
              <p className="text-muted-foreground mb-6">
                {t("noUpcomingClassesDescription")}
              </p>
              <ScheduleLiveClassDialog
                courses={courses}
                trigger={
                  <Button>
                    <Plus className="me-2 h-4 w-4" />
                    {t("scheduleClass")}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((liveClass) => (
                <LiveClassCard
                  key={liveClass.id}
                  liveClass={liveClass}
                  isInstructor
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <div className="text-center py-12">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("noPastClasses")}
              </h3>
              <p className="text-muted-foreground">
                {t("noPastClassesDescription")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {past.map((liveClass) => (
                <LiveClassCard
                  key={liveClass.id}
                  liveClass={liveClass}
                  isInstructor
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
