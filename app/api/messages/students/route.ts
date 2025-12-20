import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    // For instructors: Get all students enrolled in their courses
    const instructorProfile = await db.instructorProfile.findFirst({
      where: { userId },
    })

    if (instructorProfile) {
      // Get unique students from enrollments in instructor's courses
      const whereClause: any = {
        course: {
          instructorId: instructorProfile.id,
        },
      }

      // Only add search filter if search is provided
      if (search) {
        whereClause.user = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      }

      const enrollments = await db.enrollment.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        distinct: ["userId"],
        take: 50,
      })

      const students = enrollments.map((e) => e.user)

      return NextResponse.json({ students })
    }

    // For regular users: Get users they have messages with
    const messages = await db.message.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      select: {
        fromUserId: true,
        toUserId: true,
        fromUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      distinct: ["fromUserId", "toUserId"],
    })

    // Get unique users from messages
    const usersMap = new Map()
    messages.forEach((m) => {
      if (m.fromUserId !== userId) {
        usersMap.set(m.fromUserId, m.fromUser)
      }
      if (m.toUserId !== userId) {
        usersMap.set(m.toUserId, m.toUser)
      }
    })

    let students = Array.from(usersMap.values())

    // Filter by search
    if (search) {
      students = students.filter(
        (s) =>
          s.name?.toLowerCase().includes(search.toLowerCase()) ||
          s.email?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json({ students: students.slice(0, 50) })
  } catch (error) {
    console.error("Error fetching students:", error)
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    )
  }
}
