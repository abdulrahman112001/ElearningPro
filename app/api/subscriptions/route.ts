import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readJson, apiErrorResponse } from "@/lib/api-error"
import { getActiveTeacherSubscription } from "@/lib/access"
import { activateTeacherSubscription, expireLapsedSubscriptions } from "@/lib/teacher-subscription"
import { logActivity } from "@/lib/activity"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" })

// GET /api/subscriptions: the signed-in student's teacher subscriptions
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await expireLapsedSubscriptions()
    const subscriptions = await db.teacherSubscription.findMany({
      where: { studentId: session.user.id, status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { id: true, name: true, image: true, headline: true } },
      },
    })
    return NextResponse.json(subscriptions)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get subscriptions error:", error)
    return NextResponse.json({ error: "Failed to get subscriptions" }, { status: 500 })
  }
}

// POST /api/subscriptions { instructorId, paymentMethod }
// Starts (or renews) a monthly subscription to an instructor.
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { instructorId, paymentMethod = "stripe" } = await readJson(request)
    if (typeof instructorId !== "string" || !instructorId) {
      return NextResponse.json({ error: "instructorId is required" }, { status: 400 })
    }
    if (!["stripe", "paypal", "paymob", "tap"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
    if (instructorId === session.user.id) {
      return NextResponse.json({ error: "You cannot subscribe to yourself" }, { status: 400 })
    }

    const instructor = await db.user.findFirst({
      where: { id: instructorId, role: "INSTRUCTOR", isBlocked: false },
      select: {
        id: true,
        name: true,
        instructorProfile: { select: { isApproved: true, subscriptionEnabled: true, monthlyPrice: true, commissionRate: true } },
      },
    })
    const profile = instructor?.instructorProfile
    if (!instructor || !profile?.subscriptionEnabled || !profile.isApproved) {
      return NextResponse.json({ error: "This instructor does not offer a subscription" }, { status: 404 })
    }

    const price = profile.monthlyPrice
    const platformShare = Number(((price * (profile.commissionRate ?? 30)) / 100).toFixed(2))
    const instructorShare = Number((price - platformShare).toFixed(2))

    await logActivity({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "subscription.started",
      entityType: "user",
      entityId: instructor.id,
      summary: `Started subscription to ${instructor.name ?? "instructor"} (${price} EGP)`,
    })

    // Free subscription: activate immediately.
    if (price <= 0) {
      const subscription = await activateTeacherSubscription({
        studentId: session.user.id,
        instructorId: instructor.id,
        amount: 0,
      })
      return NextResponse.json({ activated: true, subscription }, { status: 201 })
    }

    if (paymentMethod !== "stripe") {
      return NextResponse.json({ error: "This payment method is not available yet" }, { status: 501 })
    }

    const existing = await getActiveTeacherSubscription(session.user.id, instructor.id)

    const checkout = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "egp",
            product_data: {
              name: `Monthly subscription: ${instructor.name ?? "Instructor"}`,
              description: existing ? "Renewal: adds 30 days to your current subscription" : "30 days of access to all courses",
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/subscriptions?success=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/instructors/${instructor.id}`,
      customer_email: session.user.email ?? undefined,
      metadata: {
        type: "teacher_subscription",
        userId: session.user.id,
        instructorId: instructor.id,
        amount: price.toString(),
        instructorShare: instructorShare.toString(),
        platformShare: platformShare.toString(),
      },
    })

    return NextResponse.json({ redirectUrl: checkout.url })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Create subscription error:", error)
    return NextResponse.json({ error: "Failed to start subscription" }, { status: 500 })
  }
}
