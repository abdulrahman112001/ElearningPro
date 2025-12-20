"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format, isPast, isFuture, isToday } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import {
  Video,
  Calendar,
  Clock,
  Users,
  MoreVertical,
  Play,
  Trash2,
  Edit,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface LiveClassCardProps {
  liveClass: {
    id: string
    title: string
    titleAr: string | null
    description: string | null
    scheduledAt: Date
    duration: number
    status: string
    course: {
      title: string
      titleAr: string | null
      slug: string
    } | null
    _count: {
      attendees: number
    }
  }
  isInstructor?: boolean
}

export function LiveClassCard({
  liveClass,
  isInstructor = false,
}: LiveClassCardProps) {
  const t = useTranslations("live")
  const locale = useLocale()
  const router = useRouter()
  const dateLocale = locale === "ar" ? ar : enUS

  const title =
    locale === "ar" && liveClass.titleAr ? liveClass.titleAr : liveClass.titleEn
  const courseTitle =
    liveClass.course &&
    (locale === "ar" && liveClass.course.titleAr
      ? liveClass.course.titleAr
      : liveClass.course.titleEn)

  const scheduledDate = new Date(liveClass.scheduledAt)
  const canStart = isToday(scheduledDate) || isPast(scheduledDate)
  const isScheduledFuture = isFuture(scheduledDate)

  const getStatusBadge = () => {
    switch (liveClass.status) {
      case "LIVE":
        return (
          <Badge variant="destructive" className="animate-pulse">
            ● {t("live")}
          </Badge>
        )
      case "ENDED":
        return <Badge variant="secondary">{t("ended")}</Badge>
      case "SCHEDULED":
        if (isScheduledFuture) {
          return <Badge variant="outline">{t("scheduled")}</Badge>
        }
        return <Badge variant="default">{t("ready")}</Badge>
      default:
        return null
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/live/${liveClass.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete")
      }

      toast.success(t("classDeleted"))
      router.refresh()
    } catch (error) {
      toast.error(t("deleteError"))
    }
  }

  const handleStartClass = () => {
    router.push(`/live/${liveClass.id}`)
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {courseTitle && (
              <Badge variant="outline" className="text-xs">
                {courseTitle}
              </Badge>
            )}
          </div>

          {isInstructor && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {liveClass.status === "SCHEDULED" && canStart && (
                  <DropdownMenuItem onClick={handleStartClass}>
                    <Play className="me-2 h-4 w-4" />
                    {t("startClass")}
                  </DropdownMenuItem>
                )}

                {liveClass.status === "LIVE" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/live/${liveClass.id}`}>
                      <ExternalLink className="me-2 h-4 w-4" />
                      {t("goToClass")}
                    </Link>
                  </DropdownMenuItem>
                )}

                {liveClass.status === "SCHEDULED" && (
                  <>
                    <DropdownMenuItem>
                      <Edit className="me-2 h-4 w-4" />
                      {t("edit")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive"
                    >
                      <Trash2 className="me-2 h-4 w-4" />
                      {t("delete")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("confirmDeleteDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        {t("delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <CardTitle className="text-lg mt-2">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        {liveClass.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {liveClass.description}
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{format(scheduledDate, "PPP", { locale: dateLocale })}</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{format(scheduledDate, "p", { locale: dateLocale })}</span>
          </div>

          <div className="flex items-center gap-1">
            <Video className="h-4 w-4" />
            <span>
              {liveClass.duration} {t("minutes")}
            </span>
          </div>

          {liveClass._count.attendees > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                {liveClass._count.attendees} {t("attendees")}
              </span>
            </div>
          )}
        </div>

        {/* Actions for students */}
        {!isInstructor && liveClass.status === "LIVE" && (
          <Button className="w-full mt-4" asChild>
            <Link href={`/live/${liveClass.id}`}>
              <Video className="me-2 h-4 w-4" />
              {t("joinNow")}
            </Link>
          </Button>
        )}

        {/* Actions for instructor */}
        {isInstructor && liveClass.status === "SCHEDULED" && canStart && (
          <Button className="w-full mt-4" onClick={handleStartClass}>
            <Play className="me-2 h-4 w-4" />
            {t("startClass")}
          </Button>
        )}

        {isInstructor && liveClass.status === "LIVE" && (
          <Button className="w-full mt-4" variant="destructive" asChild>
            <Link href={`/live/${liveClass.id}`}>
              <Video className="me-2 h-4 w-4" />
              {t("goToClass")}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
