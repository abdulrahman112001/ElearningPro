import { Suspense } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import Stripe from "stripe"
import { CheckCircle, Play, BookOpen, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { db } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

interface SuccessPageProps {
  searchParams: {
    session_id?: string
  }
}

async function SuccessContent({ sessionId }: { sessionId: string }) {
  const t = await getTranslations("checkout")

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })

  if (!session || session.payment_status !== "paid") {
    redirect("/")
  }

  const { courseId } = session.metadata!

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      chapters: {
        where: { isPublished: true },
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            take: 1,
          },
        },
        take: 1,
      },
    },
  })

  if (!course) {
    redirect("/")
  }

  const firstLesson = course.chapters[0]?.lessons[0]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white dark:from-green-900/10 dark:to-background py-12 px-4">
      <Card className="max-w-lg w-full text-center">
        <CardContent className="pt-10 pb-8 px-8">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold mb-3">{t("successTitle")}</h1>

          <p className="text-muted-foreground mb-6">{t("successMessage")}</p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h2 className="font-medium mb-1">
              {course.titleAr || course.titleEn}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session.amount_total! / 100} ج.م
            </p>
          </div>

          <div className="space-y-3">
            {firstLesson ? (
              <Button asChild className="w-full" size="lg">
                <Link href={`/courses/${course.slug}/learn/${firstLesson.id}`}>
                  <Play className="ms-2 h-5 w-5" />
                  {t("startLearning")}
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full" size="lg">
                <Link href={`/courses/${course.slug}/learn`}>
                  <Play className="ms-2 h-5 w-5" />
                  {t("startLearning")}
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" className="w-full">
              <Link href="/student/courses">
                <BookOpen className="ms-2 h-5 w-5" />
                {t("myCoursesBtn")}
              </Link>
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link href="/courses">
                {t("browseMore")}
                <ArrowRight className="me-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  if (!searchParams.session_id) {
    redirect("/")
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      }
    >
      <SuccessContent sessionId={searchParams.session_id} />
    </Suspense>
  )
}
