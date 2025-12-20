"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import {
  Video,
  Calendar,
  Clock,
  Users,
  PlayCircle,
  CalendarClock,
  History,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LiveClass {
  id: string
  title: string
  titleAr?: string
  description?: string
  scheduledAt: string
  duration: number
  status: "SCHEDULED" | "LIVE" | "ENDED"
  instructor: {
    id: string
    name: string
    image?: string
  }
  course?: {
    id: string
    titleAr?: string
    titleEn?: string
  }
  _count?: {
    attendees: number
  }
}

export default function StudentLiveClassesPage() {
  const t = useTranslations("student")
  const tLive = useTranslations("live")
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("upcoming")

  useEffect(() => {
    const fetchLiveClasses = async () => {
      try {
        const res = await fetch("/api/student/live-classes")
        if (res.ok) {
          const data = await res.json()
          setLiveClasses(data)
        }
      } catch (error) {
        console.error("Error fetching live classes:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLiveClasses()
  }, [])

  const upcomingClasses = liveClasses.filter(
    (c) => c.status === "SCHEDULED" || c.status === "LIVE"
  )
  const pastClasses = liveClasses.filter((c) => c.status === "ENDED")
  const liveNow = liveClasses.filter((c) => c.status === "LIVE")

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return (
          <Badge className="bg-red-500 text-white animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full me-1 animate-pulse" />
            {tLive("liveNow") || "مباشر الآن"}
          </Badge>
        )
      case "SCHEDULED":
        return (
          <Badge variant="secondary">
            <CalendarClock className="w-3 h-3 me-1" />
            {tLive("scheduled") || "مجدول"}
          </Badge>
        )
      case "ENDED":
        return (
          <Badge variant="outline">
            <History className="w-3 h-3 me-1" />
            {tLive("ended") || "انتهى"}
          </Badge>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("liveClasses")}</h1>
        <p className="text-muted-foreground">
          {t("liveClassesDescription") || "الفصول المباشرة المتاحة لك"}
        </p>
      </div>

      {/* Live Now Section */}
      {liveNow.length > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Video className="h-5 w-5 animate-pulse" />
              {tLive("liveNow") || "مباشر الآن"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {liveNow.map((liveClass) => (
                <Card key={liveClass.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">
                          {liveClass.titleAr || liveClass.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {liveClass.instructor.name}
                        </p>
                      </div>
                      {getStatusBadge(liveClass.status)}
                    </div>
                    <Button
                      asChild
                      className="w-full bg-red-500 hover:bg-red-600"
                    >
                      <Link href={`/live/${liveClass.id}`}>
                        <PlayCircle className="h-4 w-4 me-2" />
                        {tLive("joinNow") || "انضم الآن"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for upcoming and past */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            {tLive("upcoming") || "القادمة"}
            {upcomingClasses.length > 0 && (
              <Badge variant="secondary" className="ms-1">
                {upcomingClasses.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2">
            <History className="h-4 w-4" />
            {tLive("past") || "السابقة"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {upcomingClasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">
                  {tLive("noUpcomingClasses") || "لا توجد فصول قادمة"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {tLive("noUpcomingClassesDescription") ||
                    "لم يتم جدولة أي فصول مباشرة بعد"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingClasses.map((liveClass) => (
                <Card key={liveClass.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-1">
                          {liveClass.titleAr || liveClass.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {liveClass.instructor.name}
                        </p>
                      </div>
                      {getStatusBadge(liveClass.status)}
                    </div>

                    {liveClass.course && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {liveClass.course.titleAr || liveClass.course.titleEn}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(
                          new Date(liveClass.scheduledAt),
                          "dd MMM yyyy",
                          {
                            locale: ar,
                          }
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(liveClass.scheduledAt), "hh:mm a", {
                          locale: ar,
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{liveClass._count?.attendees || 0}</span>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant={
                          liveClass.status === "LIVE" ? "default" : "outline"
                        }
                      >
                        <Link href={`/live/${liveClass.id}`}>
                          {liveClass.status === "LIVE"
                            ? tLive("joinNow") || "انضم الآن"
                            : tLive("viewDetails") || "عرض التفاصيل"}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {pastClasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">
                  {tLive("noPastClasses") || "لا توجد فصول سابقة"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {tLive("noPastClassesDescription") ||
                    "لم تحضر أي فصول مباشرة بعد"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastClasses.map((liveClass) => (
                <Card key={liveClass.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold line-clamp-1">
                          {liveClass.titleAr || liveClass.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {liveClass.instructor.name}
                        </p>
                      </div>
                      {getStatusBadge(liveClass.status)}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(
                          new Date(liveClass.scheduledAt),
                          "dd MMM yyyy",
                          {
                            locale: ar,
                          }
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {liveClass.duration} {t("minutes")}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
