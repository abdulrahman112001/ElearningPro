import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import Image from "next/image"
import {
  Plus,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  Users,
  Star,
  PlayCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export async function generateMetadata() {
  const t = await getTranslations("instructor")
  return {
    title: t("myCourses"),
  }
}

export default async function InstructorCoursesPage() {
  const session = await auth()
  const t = await getTranslations("instructor")

  if (!session?.user?.id) return null

  const courses = await db.course.findMany({
    where: { instructorId: session.user.id },
    include: {
      category: true,
      _count: {
        select: {
          enrollments: true,
          reviews: true,
          chapters: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge className="bg-green-500">{t("published")}</Badge>
      case "DRAFT":
        return <Badge variant="secondary">{t("draft")}</Badge>
      case "PENDING":
        return <Badge variant="warning">{t("pending")}</Badge>
      case "REJECTED":
        return <Badge variant="destructive">{t("rejected")}</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("myCourses")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("myCoursesDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href="/instructor/courses/create">
            <Plus className="h-4 w-4 ms-2" />
            {t("createCourse")}
          </Link>
        </Button>
      </div>

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <PlayCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("noCourses")}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t("noCoursesDescription")}
            </p>
            <Button asChild>
              <Link href="/instructor/courses/create">
                <Plus className="h-4 w-4 ms-2" />
                {t("createFirst")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden group">
              {/* Thumbnail */}
              <div className="relative aspect-video">
                {course.thumbnail ? (
                  <Image
                    src={course.thumbnail}
                    alt={course.titleEn}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-primary/50" />
                  </div>
                )}
                <div className="absolute top-2 start-2 end-2 flex justify-between">
                  {getStatusBadge(course.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/instructor/courses/${course.id}/edit`}>
                          <Edit className="h-4 w-4 ms-2" />
                          {t("edit")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/courses/${course.slug}`}>
                          <Eye className="h-4 w-4 ms-2" />
                          {t("preview")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 ms-2" />
                        {t("delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Category */}
                <p className="text-xs text-primary font-medium">
                  {course.category?.nameAr || course.category?.nameEn}
                </p>

                {/* Title */}
                <h3 className="font-semibold line-clamp-2">
                  {course.titleAr || course.titleEn}
                </h3>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{course._count.enrollments}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span>{course.averageRating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PlayCircle className="h-4 w-4" />
                    <span>
                      {course._count.chapters} {t("chapters")}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-bold">
                    {course.price === 0 ? t("free") : `${course.price} ج.م`}
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/instructor/courses/${course.id}/edit`}>
                      {t("manage")}
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
