import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"

// Configure max file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Allowed file types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string | null // "thumbnail", "avatar", etc.

    if (!file) {
      return NextResponse.json(
        { error: "No file provided", errorAr: "لم يتم تحديد ملف" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed",
          errorAr: "نوع الملف غير مسموح. فقط JPEG, PNG, GIF, WebP",
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large. Maximum size is 5MB",
          errorAr: "حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت",
        },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      type || "images"
    )
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop()
    const uniqueFilename = `${uuidv4()}.${fileExtension}`
    const filePath = path.join(uploadsDir, uniqueFilename)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Return the public URL
    const publicUrl = `/uploads/${type || "images"}/${uniqueFilename}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: uniqueFilename,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Upload failed", errorAr: "فشل رفع الملف" },
      { status: 500 }
    )
  }
}

// Delete uploaded file
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url || !url.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), "public", url)

    // Check if file exists before deleting
    if (existsSync(filePath)) {
      const { unlink } = await import("fs/promises")
      await unlink(filePath)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
