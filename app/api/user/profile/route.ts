import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

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
    })
  } catch (error) {
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

    const body = await request.json()
    const { name, bio, image, headline, website, twitter, linkedin, youtube } =
      body

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
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
