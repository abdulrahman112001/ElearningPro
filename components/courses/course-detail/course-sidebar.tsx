"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import {
  PlayCircle,
  Clock,
  Award,
  Download,
  Smartphone,
  Infinity,
  Heart,
  Share2,
  Loader2,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface CourseSidebarProps {
  course: {
    id: string
    slug: string
    titleEn: string
    titleAr?: string
    thumbnail?: string | null
    price: number
    discountPrice?: number | null
    promoVideo?: string | null
    isFree?: boolean
  }
  enrollment: {
    id: string
    createdAt: Date
  } | null
  progressPercentage: number
  totalLessons: number
  completedLessons: number
}

export function CourseSidebar({
  course,
  enrollment,
  progressPercentage,
  totalLessons,
  completedLessons,
}: CourseSidebarProps) {
  const t = useTranslations("courses")
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)

  const handleEnroll = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/courses/${course.slug}`)
      return
    }

    // Free course - enroll directly
    if (
      course.price === 0 ||
      (course.discountPrice !== undefined && course.discountPrice === 0)
    ) {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/courses/${course.id}/enroll`, {
          method: "POST",
        })

        if (!response.ok) throw new Error()

        toast.success("تم التسجيل في الكورس بنجاح")
        router.refresh()
      } catch (error) {
        toast.error("حدث خطأ أثناء التسجيل")
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Paid course - go to checkout
    router.push(`/checkout/${course.slug}`)
  }

  const handleWishlist = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/courses/${course.slug}`)
      return
    }

    setIsWishlisted(!isWishlisted)
    toast.success(isWishlisted ? "تم الحذف من المفضلة" : "تم الإضافة للمفضلة")
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: course.titleEn || course.titleAr,
        url: window.location.href,
      })
    } catch {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("تم نسخ الرابط")
    }
  }

  const discountPercentage = course.discountPrice
    ? Math.round((1 - course.discountPrice / course.price) * 100)
    : 0

  return (
    <Card className="sticky top-24">
      {/* Video Preview */}
      {course.thumbnail && (
        <div className="relative aspect-video">
          <Image
            src={course.thumbnail}
            alt={course.titleEn}
            fill
            className="object-cover rounded-t-lg"
          />
          {course.previewVideo && (
            <button className="absolute inset-0 flex items-center justify-center bg-black/30 group">
              <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform">
                <PlayCircle className="h-8 w-8 text-primary" />
              </div>
            </button>
          )}
        </div>
      )}

      <CardContent className="p-6 space-y-4">
        {/* Price */}
        {!enrollment && (
          <div className="space-y-2">
            {course.price === 0 ? (
              <p className="text-3xl font-bold text-green-600">{t("free")}</p>
            ) : (
              <div className="flex items-baseline gap-3">
                {course.discountPrice && course.discountPrice < course.price ? (
                  <>
                    <span className="text-3xl font-bold">
                      {course.discountPrice.toFixed(0)} ج.م
                    </span>
                    <span className="text-lg text-muted-foreground line-through">
                      {course.price.toFixed(0)} ج.م
                    </span>
                    <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded text-sm">
                      -{discountPercentage}%
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-bold">
                    {course.price.toFixed(0)} ج.م
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress (if enrolled) */}
        {enrollment && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{t("yourProgress")}</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {completedLessons} / {totalLessons} {t("lessonsCompleted")}
            </p>
          </div>
        )}

        {/* CTA Button */}
        {enrollment ? (
          <Button asChild className="w-full" size="lg">
            <Link href={`/courses/${course.slug}/learn`}>
              {t("continueLearning")}
            </Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleEnroll}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {course.price === 0 ? t("enrollFree") : t("enrollNow")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/checkout/${course.slug}?cart=true`)}
            >
              {t("addToCart")}
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleWishlist}>
            <Heart
              className={`h-4 w-4 ml-2 ${
                isWishlisted ? "fill-red-500 text-red-500" : ""
              }`}
            />
            {t("wishlist")}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleShare}>
            <Share2 className="h-4 w-4 ml-2" />
            {t("share")}
          </Button>
        </div>

        <Separator />

        {/* Course Includes */}
        <div className="space-y-3">
          <h4 className="font-semibold">{t("courseIncludes")}</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-muted-foreground" />
              <span>{t("videoContent")}</span>
            </li>
            <li className="flex items-center gap-3">
              <Download className="h-5 w-5 text-muted-foreground" />
              <span>{t("downloadableResources")}</span>
            </li>
            <li className="flex items-center gap-3">
              <Infinity className="h-5 w-5 text-muted-foreground" />
              <span>{t("lifetimeAccess")}</span>
            </li>
            <li className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <span>{t("mobileAccess")}</span>
            </li>
            <li className="flex items-center gap-3">
              <Award className="h-5 w-5 text-muted-foreground" />
              <span>{t("certificateCompletion")}</span>
            </li>
          </ul>
        </div>

        {/* Money Back Guarantee */}
        {!enrollment && course.price > 0 && (
          <>
            <Separator />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("moneyBackGuarantee")}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
