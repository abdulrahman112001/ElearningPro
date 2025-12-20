import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const purchases = await db.payment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          select: {
            id: true,
            slug: true,
            titleAr: true,
            titleEn: true,
            thumbnail: true,
            instructor: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(purchases)
  } catch (error) {
    console.error("[STUDENT_PURCHASES_GET]", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
