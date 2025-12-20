import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { code, courseId } = body

    if (!code || !courseId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find coupon
    const coupon = await db.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        expiresAt: { gte: new Date() },
      },
    })

    if (!coupon) {
      return NextResponse.json(
        { error: "Invalid or expired coupon" },
        { status: 404 }
      )
    }

    // Check max uses
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { error: "Coupon usage limit reached" },
        { status: 400 }
      )
    }

    // Check if user already used this coupon
    const existingUse = await db.purchase.findFirst({
      where: {
        userId: session.user.id,
        couponId: coupon.id,
      },
    })

    if (existingUse) {
      return NextResponse.json(
        { error: "You have already used this coupon" },
        { status: 400 }
      )
    }

    // Get course price
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        price: true,
        discountPrice: true,
      },
    })

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 })
    }

    const coursePrice =
      course.discountPrice !== null && course.discountPrice < course.price
        ? course.discountPrice
        : course.price

    // Calculate discount
    let discount = 0
    if (coupon.discountType === "PERCENTAGE") {
      discount = (coursePrice * coupon.discountValue) / 100
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount
      }
    } else {
      discount = coupon.discountValue
    }

    // Ensure discount doesn't exceed price
    discount = Math.min(discount, coursePrice)

    return NextResponse.json({
      code: coupon.code,
      discount,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    })
  } catch (error) {
    console.error("Coupon validation error:", error)
    return NextResponse.json(
      { error: "Failed to validate coupon" },
      { status: 500 }
    )
  }
}
