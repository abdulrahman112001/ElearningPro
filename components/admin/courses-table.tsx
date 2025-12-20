"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import Link from "next/link"
import Image from "next/image"
import {
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Star,
  Eye,
  Users,
  BookOpen,
  Clock,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface Course {
  id: string
  titleEn: string
  titleAr?: string
  slug: string
  thumbnail: string | null
  price: number
  status: string
  isFeatured: boolean
  totalStudents: number
  averageRating: number
  createdAt: Date
  instructor: {
    id: string
    name: string | null
    email: string
  }
  category: {
    id: string
    nameEn: string
    nameAr?: string
  } | null
  _count: {
    chapters: number
    enrollments: number
    reviews: number
  }
}

interface CoursesTableProps {
  courses: Course[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function CoursesTable({ courses, pagination }: CoursesTableProps) {
  const t = useTranslations("admin")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<Course | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")
    router.push(`/admin/courses?${params.toString()}`)
  }

  const handleAction = async (
    courseId: string,
    action: string,
    reason?: string
  ) => {
    setProcessing(courseId)

    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      })

      if (!response.ok) throw new Error("Failed to process action")

      toast.success(
        action === "approve"
          ? t("courseApproved")
          : action === "reject"
          ? t("courseRejected")
          : action === "feature"
          ? t("courseFeatured")
          : t("courseUnfeatured")
      )
      setRejectDialog(null)
      setRejectReason("")
      router.refresh()
    } catch (error) {
      toast.error(t("error"))
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="me-1 h-3 w-3" />
            {t("published")}
          </Badge>
        )
      case "PENDING_REVIEW":
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Clock className="me-1 h-3 w-3" />
            {t("pendingReview")}
          </Badge>
        )
      case "DRAFT":
        return <Badge variant="secondary">{t("draft")}</Badge>
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <XCircle className="me-1 h-3 w-3" />
            {t("rejected")}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder={t("searchCourses")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(value) => {
            const params = new URLSearchParams(searchParams.toString())
            if (value && value !== "all") params.set("status", value)
            else params.delete("status")
            params.delete("page")
            router.push(`/admin/courses?${params.toString()}`)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="DRAFT">{t("draft")}</SelectItem>
            <SelectItem value="PENDING_REVIEW">{t("pendingReview")}</SelectItem>
            <SelectItem value="PUBLISHED">{t("published")}</SelectItem>
            <SelectItem value="REJECTED">{t("rejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("course")}</TableHead>
              <TableHead>{t("instructor")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("stats")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  {t("noCourses")}
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-20 rounded overflow-hidden bg-muted">
                        {course.thumbnail ? (
                          <Image
                            src={course.thumbnail}
                            alt={course.titleEn}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">
                          {locale === "ar"
                            ? course.titleAr || course.titleEn
                            : course.titleEn}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {locale === "ar"
                            ? course.category?.nameAr || course.category?.nameEn
                            : course.category?.nameEn || t("uncategorized")}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {course.instructor.name || "No name"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {course.instructor.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(course.status)}
                      {course.isFeatured && (
                        <Badge variant="outline" className="text-yellow-600">
                          <Star className="me-1 h-3 w-3 fill-yellow-500" />
                          {t("featured")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {course.totalStudents}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        {course.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {course.price === 0 ? (
                      <Badge variant="secondary">{t("free")}</Badge>
                    ) : (
                      <span className="font-medium">${course.price}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/courses/${course.slug}`}>
                            <Eye className="me-2 h-4 w-4" />
                            {t("viewCourse")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />

                        {course.status === "PENDING_REVIEW" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleAction(course.id, "approve")}
                              disabled={processing === course.id}
                            >
                              <CheckCircle className="me-2 h-4 w-4 text-green-600" />
                              {t("approve")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRejectDialog(course)}
                            >
                              <XCircle className="me-2 h-4 w-4 text-red-600" />
                              {t("reject")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}

                        {course.status === "PUBLISHED" && (
                          <>
                            {course.isFeatured ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction(course.id, "unfeature")
                                }
                                disabled={processing === course.id}
                              >
                                <Star className="me-2 h-4 w-4" />
                                {t("removeFeatured")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction(course.id, "feature")
                                }
                                disabled={processing === course.id}
                              >
                                <Star className="me-2 h-4 w-4 fill-yellow-500 text-yellow-500" />
                                {t("makeFeatured")}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectCourse")}</DialogTitle>
            <DialogDescription>
              {t("rejectCourseDescription", { title: rejectDialog?.title })}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder={t("rejectReasonPlaceholder")}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectDialog &&
                handleAction(rejectDialog.id, "reject", rejectReason)
              }
              disabled={!rejectReason || processing === rejectDialog?.id}
            >
              {processing === rejectDialog?.id && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
