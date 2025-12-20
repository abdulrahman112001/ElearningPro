import { NextResponse } from "next/server"
import Stripe from "stripe"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { courseId, paymentMethod, couponCode } = body

    // Fetch course
    const course = await db.course.findUnique({
      where: {
        id: courseId,
        status: "PUBLISHED",
      },
      include: {
        instructor: true,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    // Check if already enrolled
    const existingEnrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    })

    if (existingEnrollment) {
      return NextResponse.json({ error: "Already enrolled" }, { status: 400 })
    }

    // Calculate final price
    let finalPrice =
      course.discountPrice !== null && course.discountPrice < course.price
        ? course.discountPrice
        : course.price

    // Validate coupon
    let couponDiscount = 0
    let coupon = null

    if (couponCode) {
      coupon = await db.coupon.findFirst({
        where: {
          code: couponCode,
          isActive: true,
          expiresAt: { gte: new Date() },
          OR: [
            { maxUses: null },
            { usedCount: { lt: db.coupon.fields.maxUses } },
          ],
        },
      })

      if (coupon) {
        if (coupon.discountType === "PERCENTAGE") {
          couponDiscount = (finalPrice * coupon.discountValue) / 100
          if (coupon.maxDiscount && couponDiscount > coupon.maxDiscount) {
            couponDiscount = coupon.maxDiscount
          }
        } else {
          couponDiscount = coupon.discountValue
        }
        finalPrice = Math.max(0, finalPrice - couponDiscount)
      }
    }

    // Platform fee (e.g., 20%)
    const platformFee = 0.2
    const instructorEarnings = finalPrice * (1 - platformFee)

    // Handle different payment methods
    switch (paymentMethod) {
      case "stripe":
        return handleStripePayment(
          session,
          course,
          finalPrice,
          instructorEarnings,
          coupon
        )

      case "paypal":
        return handlePayPalPayment(
          session,
          course,
          finalPrice,
          instructorEarnings,
          coupon
        )

      case "paymob":
        return handlePaymobPayment(
          session,
          course,
          finalPrice,
          instructorEarnings,
          coupon
        )

      case "tap":
        return handleTapPayment(
          session,
          course,
          finalPrice,
          instructorEarnings,
          coupon
        )

      default:
        return NextResponse.json(
          { error: "Invalid payment method" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Payment error:", error)
    return NextResponse.json({ error: "Payment failed" }, { status: 500 })
  }
}

async function handleStripePayment(
  session: any,
  course: any,
  amount: number,
  instructorEarnings: number,
  coupon: any
) {
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "egp",
          product_data: {
            name: course.titleEn,
            description: course.descriptionEn?.slice(0, 200) || "",
            images: course.thumbnail ? [course.thumbnail] : [],
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${course.slug}`,
    metadata: {
      userId: session.user.id,
      courseId: course.id,
      instructorId: course.instructorId,
      instructorEarnings: instructorEarnings.toString(),
      couponId: coupon?.id || "",
    },
    customer_email: session.user.email,
  })

  return NextResponse.json({ redirectUrl: checkoutSession.url })
}

async function handlePayPalPayment(
  session: any,
  course: any,
  amount: number,
  instructorEarnings: number,
  coupon: any
) {
  // PayPal integration would go here
  // For now, return a placeholder
  return NextResponse.json({
    error: "PayPal integration coming soon",
    status: 501,
  })
}

async function handlePaymobPayment(
  session: any,
  course: any,
  amount: number,
  instructorEarnings: number,
  coupon: any
) {
  // Paymob (Egypt) integration would go here
  // For now, return a placeholder
  return NextResponse.json({
    error: "Paymob integration coming soon",
    status: 501,
  })
}

async function handleTapPayment(
  session: any,
  course: any,
  amount: number,
  instructorEarnings: number,
  coupon: any
) {
  // Tap (Gulf) integration would go here
  // For now, return a placeholder
  return NextResponse.json({
    error: "Tap integration coming soon",
    status: 501,
  })
}
