import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { readJson, apiErrorResponse } from "@/lib/api-error"

// Get user profile
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        instructorProfile: true,
        gradeLevel: { select: { id: true, nameAr: true, nameEn: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      bio: user.bio,
      headline: user.headline,
      website: user.website,
      twitter: user.twitter,
      linkedin: user.linkedin,
      youtube: user.youtube,
      role: user.role,
      instructorProfile: user.instructorProfile,
      gradeLevelId: user.gradeLevelId,
      gradeLevel: user.gradeLevel,
      guardianName: user.guardianName,
      guardianEmail: user.guardianEmail,
      guardianPhone: user.guardianPhone,
    })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get profile error:", error)
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    )
  }
}

// Update user profile
export async function PATCH(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await readJson(request)
    const { name, bio, image, headline, website, twitter, linkedin, youtube } =
      body
    const { gradeLevelId, guardianName, guardianEmail, guardianPhone } = body

    // Optional text fields: string or null (null clears the value)
    const optionalText = (v: unknown, max: number) =>
      v === undefined || v === null || (typeof v === "string" && v.length <= max)
    if (!optionalText(guardianName, 100) || !optionalText(guardianPhone, 30)) {
      return NextResponse.json({ error: "Invalid guardian details" }, { status: 400 })
    }
    if (
      guardianEmail !== undefined && guardianEmail !== null && guardianEmail !== "" &&
      (typeof guardianEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))
    ) {
      return NextResponse.json({ error: "Invalid guardian email" }, { status: 400 })
    }
    if (gradeLevelId !== undefined && gradeLevelId !== null && gradeLevelId !== "") {
      const grade = await db.gradeLevel.findFirst({ where: { id: String(gradeLevelId), isActive: true }, select: { id: true } })
      if (!grade) return NextResponse.json({ error: "Grade level not found" }, { status: 404 })
    }

    // Update user with all profile fields
    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(bio !== undefined && { bio }),
        ...(image && { image }),
        ...(headline !== undefined && { headline }),
        ...(website !== undefined && { website }),
        ...(twitter !== undefined && { twitter }),
        ...(linkedin !== undefined && { linkedin }),
        ...(youtube !== undefined && { youtube }),
        ...(gradeLevelId !== undefined && { gradeLevelId: gradeLevelId || null }),
        ...(guardianName !== undefined && { guardianName: guardianName?.trim() || null }),
        ...(guardianEmail !== undefined && { guardianEmail: guardianEmail?.trim().toLowerCase() || null }),
        ...(guardianPhone !== undefined && { guardianPhone: guardianPhone?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
