"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { format } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import toast from "react-hot-toast"
import { Search, Star, Trash2, MessageSquareText } from "lucide-react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ReviewUser {
  id: string
  name: string | null
  email: string
  image?: string | null
}

interface ReviewCourse {
  id: string
  titleEn: string
  titleAr?: string | null
  instructor?: {
    name: string | null
  } | null
}

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  user: ReviewUser
  course: ReviewCourse
}

interface ReviewStats {
  averageRating: number
  totalCount: number
}

interface ReviewsTableProps {
  reviews: Review[]
  stats: ReviewStats
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const ratingOptions = ["all", "5", "4", "3", "2", "1"]

export function ReviewsTable({
  reviews,
  stats,
  pagination,
}: ReviewsTableProps) {
  const t = useTranslations("admin")
  const common = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams() as URLSearchParams
  const dateLocale = locale === "ar" ? ar : enUS

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [ratingFilter, setRatingFilter] = useState(
    searchParams.get("rating") || "all"
  )
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)
  const [viewReview, setViewReview] = useState<Review | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")
    router.push(`/admin/reviews?${params.toString()}`)
  }

  const handleRatingChange = (value: string) => {
    setRatingFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") params.set("rating", value)
    else params.delete("rating")
    params.delete("page")
    router.push(`/admin/reviews?${params.toString()}`)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setProcessingId(deleteTarget.id)
    try {
      const response = await fetch(`/api/admin/reviews/${deleteTarget.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("delete_failed")

      toast.success(t("reviewDeleted"))
      setDeleteTarget(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error(common("error"))
    } finally {
      setProcessingId(null)
    }
  }

  const renderStars = (rating: number) => {
    const fullStars = Math.round(rating)
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={`h-4 w-4 ${
              index < fullStars
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            }`}
          />
        ))}
      </div>
    )
  }

  const formatDate = (value: string) => {
    try {
      return format(new Date(value), "PPpp", { locale: dateLocale })
    } catch (error) {
      return "—"
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("totalReviews")}</p>
          <p className="text-2xl font-semibold">{stats.totalCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">{t("averageRating")}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold">
              {stats.averageRating.toFixed(1)}
            </p>
            {renderStars(stats.averageRating)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-1 gap-2 lg:max-w-lg">
          <Input
            placeholder={t("searchReviews")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select value={ratingFilter} onValueChange={handleRatingChange}>
          <SelectTrigger className="w-full lg:w-48">
            <SelectValue placeholder={t("ratingFilter")} />
          </SelectTrigger>
          <SelectContent>
            {ratingOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "all"
                  ? common("all")
                  : t("ratingOption", { value: option })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("course")}</TableHead>
              <TableHead>{t("student")}</TableHead>
              <TableHead>{t("rating")}</TableHead>
              <TableHead>{t("comment")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {locale === "ar"
                        ? review.course.titleAr || review.course.titleEn
                        : review.course.titleEn}
                    </span>
                    {review.course.instructor?.name && (
                      <span className="text-sm text-muted-foreground">
                        {t("byInstructor", {
                          name: review.course.instructor.name,
                        })}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {review.user.name || t("unnamed")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {review.user.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{review.rating}</Badge>
                    {renderStars(review.rating)}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="truncate text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                </TableCell>
                <TableCell>{formatDate(review.createdAt)}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewReview(review)}
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(review)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {t("paginationLabel", {
            start: (pagination.page - 1) * pagination.limit + 1,
            end: Math.min(pagination.page * pagination.limit, pagination.total),
            total: pagination.total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={pagination.page === 1}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page - 1))
              router.push(`/admin/reviews?${params.toString()}`)
            }}
          >
            {common("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={pagination.page === pagination.pages}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.set("page", String(pagination.page + 1))
              router.push(`/admin/reviews?${params.toString()}`)
            }}
          >
            {common("next")}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteReview")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteReview")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingId === deleteTarget?.id}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex items-center gap-2"
              disabled={processingId === deleteTarget?.id}
              onClick={handleDelete}
            >
              {processingId === deleteTarget?.id && (
                <span className="h-4 w-4 animate-pulse rounded-full bg-primary" />
              )}
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(viewReview)}
        onOpenChange={(open) => !open && setViewReview(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reviewDetails")}</DialogTitle>
          </DialogHeader>
          {viewReview && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("course")}</p>
                <p className="font-medium">
                  {locale === "ar"
                    ? viewReview.course.titleAr || viewReview.course.titleEn
                    : viewReview.course.titleEn}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("student")}</p>
                <p className="font-medium">
                  {viewReview.user.name || t("unnamed")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {viewReview.user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {renderStars(viewReview.rating)}
                <Badge variant="secondary">{viewReview.rating}</Badge>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {viewReview.comment}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(viewReview.createdAt)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
