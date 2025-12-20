import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  request: Request,
  { params }: { params: { couponId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    const coupon = await db.coupon.update({
      where: { id: params.couponId },
      data: {
        ...(body.code && { code: body.code }),
        ...(body.discountType && { discountType: body.discountType }),
        ...(typeof body.discountValue === "number" && {
          discountValue: body.discountValue,
        }),
        ...(typeof body.maxUses === "number" && { maxUses: body.maxUses }),
        ...(typeof body.minPurchase === "number" && {
          minPurchase: body.minPurchase,
        }),
        ...(typeof body.maxDiscount === "number" && {
          maxDiscount: body.maxDiscount,
        }),
        ...(body.expiryDate && { expiryDate: new Date(body.expiryDate) }),
        ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
        ...(body.courseId !== undefined && { courseId: body.courseId || null }),
      },
    })

    return NextResponse.json(coupon)
  } catch (error) {
    console.error("Update coupon error:", error)
    return NextResponse.json(
      { error: "Failed to update coupon" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { couponId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.coupon.delete({ where: { id: params.couponId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete coupon error:", error)
    return NextResponse.json(
      { error: "Failed to delete coupon" },
      { status: 500 }
    )
  }
}
