"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import toast from "react-hot-toast"
import { Star, ThumbsUp, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"

interface Review {
  id: string
  rating: number
  comment?: string | null
  createdAt: Date
  user: {
    id: string
    name: string | null
    image?: string | null
  }
}

interface CourseReviewsProps {
  reviews: Review[]
  averageRating: number
  totalReviews: number
  courseId: string
  isEnrolled: boolean
}

export function CourseReviews({
  reviews,
  averageRating,
  totalReviews,
  courseId,
  isEnrolled,
}: CourseReviewsProps) {
  const t = useTranslations("courses")
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedRating, setSelectedRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{
    comment: string
  }>()

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
    return { rating, count, percentage }
  })

  const onSubmit = async (data: { comment: string }) => {
    if (!selectedRating) {
      toast.error("يرجى اختيار تقييم")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/courses/${courseId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: selectedRating,
          comment: data.comment,
        }),
      })

      if (!response.ok) throw new Error()

      toast.success("تم إرسال تقييمك بنجاح")
      reset()
      setSelectedRating(0)
      setShowForm(false)
    } catch (error) {
      toast.error("حدث خطأ أثناء إرسال التقييم")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-6">{t("reviews")}</h2>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Rating Summary */}
        <div className="md:w-64 text-center">
          <div className="text-5xl font-bold text-primary">
            {averageRating.toFixed(1)}
          </div>
          <div className="flex justify-center my-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(averageRating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {totalReviews.toLocaleString()} {t("reviews")}
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="flex-1 space-y-2">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-20">
                <span className="text-sm">{rating}</span>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </div>
              <Progress value={percentage} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground w-12 text-left">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Add Review */}
      {isEnrolled && session?.user && (
        <div className="mb-6">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>
              {t("writeReview")}
            </Button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Rating Selection */}
              <div>
                <p className="text-sm font-medium mb-2">{t("selectRating")}</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= (hoverRating || selectedRating)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <Textarea
                placeholder={t("reviewPlaceholder")}
                {...register("comment")}
                rows={4}
              />

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {t("submitReview")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setSelectedRating(0)
                    reset()
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t("noReviews")}
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="flex gap-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={review.user.image || ""} />
                <AvatarFallback>{review.user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{review.user.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.createdAt), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-2 text-muted-foreground">{review.comment}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {reviews.length > 0 && totalReviews > reviews.length && (
        <Button variant="outline" className="w-full mt-6">
          {t("loadMoreReviews")}
        </Button>
      )}
    </div>
  )
}
