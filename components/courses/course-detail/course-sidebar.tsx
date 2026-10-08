"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import {
  PlayCircle,
  Award,
  Download,
  Smartphone,
  Infinity,
  Heart,
  Share2,
  Loader2,
  Crown,
  Lock,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SubscribeButton } from "@/components/student/subscribe-button"
import { cn, formatPrice } from "@/lib/utils"

interface CourseSidebarProps {
  course: {
    id: string
    slug: string
    titleEn: string
    titleAr?: string | null
    thumbnail?: string | null
    price: number
    discountPrice?: number | null
    promoVideo?: string | null
    isFree?: boolean
    instructorId?: string
    instructor?: { name?: string | null } | null
  }
  enrollment: {
    id: string
    enrolledAt: Date
    viaSubscription?: boolean
  } | null
  progressPercentage: number
  totalLessons: number
  completedLessons: number
}

interface SubscriptionOffer {
  enabled: boolean
  monthlyPrice: number
  publishedCourses: number
  subscribed: boolean
  endsAt: string | null
}

export function CourseSidebar({
  course,
  enrollment,
  progressPercentage,
  totalLessons,
  completedLessons,
}: CourseSidebarProps) {
  const t = useTranslations("courses")
  const tSub = useTranslations("subscriptions")
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [offer, setOffer] = useState<SubscriptionOffer | null>(null)
  const [groupOnly, setGroupOnly] = useState(false)

  // Load the real wishlist state for this course.
  useEffect(() => {
    if (!session) return
    fetch(`/api/wishlist?courseId=${course.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setIsWishlisted(!!data.wishlisted))
      .catch(() => {})
  }, [session, course.id])

  // Does the teacher offer a monthly subscription, and is the viewer subscribed?
  useEffect(() => {
    if (!course.instructorId) return
    let cancelled = false
    fetch(`/api/instructors/${course.instructorId}/subscription`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setOffer(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [course.instructorId, session])

  const isFreeCourse =
    course.price === 0 ||
    (course.discountPrice !== undefined && course.discountPrice === 0)
  const subscribed = !!offer?.subscribed
  // A subscription enrollment stops opening the course once the subscription lapses.
  const lapsed = !!enrollment?.viaSubscription && !!offer && !subscribed
  const activeEnrollment = enrollment && !lapsed ? enrollment : null
  const coveredBySubscription = !isFreeCourse && subscribed
  const showUpsell = !!offer?.enabled && !subscribed && !isFreeCourse && !activeEnrollment
  const teacherName = course.instructor?.name || ""
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
  })

  const handleEnroll = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/courses/${course.slug}`)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/courses/${course.id}/enroll`, {
        method: "POST",
      })
      const data = await response.json().catch(() => ({}))

      if (response.status === 201) {
        toast.success(
          data.via === "subscription" ? tSub("enrolledViaSubscription") : t("enrollSuccess")
        )
        router.push(`/courses/${course.slug}/learn`)
        router.refresh()
        return
      }
      if (response.status === 402) {
        // Paid course without a covering subscription
        router.push(data.redirectTo || `/checkout/${course.slug}`)
        return
      }
      if (response.status === 403 && data.code === "group_only") {
        setGroupOnly(true)
        toast.error(tSub("groupOnlyTitle"))
        return
      }
      if (response.status === 400) {
        // Already enrolled
        router.push(`/courses/${course.slug}/learn`)
        return
      }
      throw new Error()
    } catch {
      toast.error(t("enrollError"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleWishlist = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/courses/${course.slug}`)
      return
    }

    const removing = isWishlisted
    try {
      const response = removing
        ? await fetch(`/api/wishlist/${course.id}`, { method: "DELETE" })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId: course.id }),
          })
      if (!response.ok) throw new Error()
      setIsWishlisted(!removing)
      toast.success(removing ? t("removedFromWishlist") : t("addedToWishlist"))
    } catch {
      toast.error(t("wishlistError"))
    }
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: course.titleEn || course.titleAr || "",
        url: window.location.href,
      })
    } catch {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(t("copiedToClipboard"))
    }
  }

  const discountPercentage = course.discountPrice
    ? Math.round((1 - course.discountPrice / course.price) * 100)
    : 0

  return (
    <Card className="sticky top-24 overflow-hidden">
      {/* Video Preview */}
      {course.thumbnail && (
        <div className="relative aspect-video">
          <Image
            src={course.thumbnail}
            alt={course.titleEn}
            fill
            className="object-cover"
          />
          {course.promoVideo && (
            <button className="group absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="rounded-full bg-white p-4 transition-transform group-hover:scale-110">
                <PlayCircle className="h-8 w-8 text-primary" />
              </div>
            </button>
          )}
        </div>
      )}

      <CardContent className="space-y-4 p-6">
        {/* Price */}
        {!activeEnrollment && (
          <div className="space-y-2">
            {coveredBySubscription ? (
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-bold text-success">{tSub("includedPrice")}</span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(course.discountPrice ?? course.price, "EGP", locale)}
                </span>
              </div>
            ) : course.price === 0 ? (
              <p className="text-3xl font-bold text-success">{t("free")}</p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-3">
                {course.discountPrice && course.discountPrice < course.price ? (
                  <>
                    <span className="text-3xl font-bold">
                      {formatPrice(course.discountPrice, "EGP", locale)}
                    </span>
                    <span className="text-lg text-muted-foreground line-through">
                      {formatPrice(course.price, "EGP", locale)}
                    </span>
                    <span className="rounded bg-destructive/10 px-2 py-1 text-sm text-destructive">
                      -{discountPercentage}%
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-bold">
                    {formatPrice(course.price, "EGP", locale)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress (if enrolled) */}
        {activeEnrollment && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{t("yourProgress")}</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {completedLessons} / {totalLessons} {t("lessonsCompleted")}
            </p>
            {activeEnrollment.viaSubscription && offer?.endsAt && (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Crown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {tSub("accessUntil", { date: dateFmt.format(new Date(offer.endsAt)) })}
              </p>
            )}
          </div>
        )}

        {/* Lapsed subscription notice */}
        {lapsed && offer && (
          <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <p className="font-medium">{tSub("lapsedNotice")}</p>
            {offer.enabled && (
              <SubscribeButton
                size="sm"
                className="w-full"
                instructorId={course.instructorId!}
                monthlyPrice={offer.monthlyPrice}
                expired
              />
            )}
          </div>
        )}

        {/* Group-only course */}
        {groupOnly && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm"
          >
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-destructive">{tSub("groupOnlyTitle")}</p>
              <p className="text-muted-foreground">{tSub("groupOnlyDescription")}</p>
            </div>
          </div>
        )}

        {/* CTA Button */}
        {activeEnrollment ? (
          <Button asChild className="w-full" size="lg">
            <Link href={`/courses/${course.slug}/learn`}>
              {t("continueLearning")}
            </Link>
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              className={cn("h-auto min-h-11 w-full whitespace-normal py-2.5")}
              size="lg"
              onClick={handleEnroll}
              disabled={isLoading || groupOnly}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : coveredBySubscription ? (
                <CheckCircle2 aria-hidden="true" />
              ) : null}
              {coveredBySubscription
                ? tSub("startIncluded")
                : course.price === 0
                  ? t("enrollFree")
                  : t("enrollNow")}
            </Button>
            {!coveredBySubscription && !isFreeCourse && !groupOnly && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/checkout/${course.slug}?cart=true`)}
              >
                {t("addToCart")}
              </Button>
            )}
          </div>
        )}

        {/* Teacher subscription upsell */}
        {showUpsell && offer && !groupOnly && !lapsed && (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Crown className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed">
                {teacherName
                  ? tSub("orSubscribe", {
                      name: teacherName,
                      price: formatPrice(offer.monthlyPrice, "EGP", locale),
                    })
                  : tSub("orSubscribeGeneric", {
                      price: formatPrice(offer.monthlyPrice, "EGP", locale),
                    })}
                {offer.publishedCourses > 1 && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {tSub("includesCount", { count: offer.publishedCourses })}
                  </span>
                )}
              </p>
            </div>
            <SubscribeButton
              size="sm"
              variant="outline"
              className="w-full"
              instructorId={course.instructorId!}
              monthlyPrice={offer.monthlyPrice}
              onActivated={() => setOffer({ ...offer, subscribed: true })}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleWishlist}>
            <Heart
              className={cn(isWishlisted && "fill-red-500 text-red-500")}
              aria-hidden="true"
            />
            {t("wishlist")}
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleShare}>
            <Share2 aria-hidden="true" />
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
        {!activeEnrollment && course.price > 0 && !coveredBySubscription && (
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
