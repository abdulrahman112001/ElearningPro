import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Enroll in a course
export async function POST(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const course = await db.course.findUnique({
      where: { 
        id: params.courseId,
        status: "PUBLISHED",
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const existingEnrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "Already enrolled" },
        { status: 400 }
      );
    }

    // For free courses, enroll directly
    if (course.price === 0 || (course.discountPrice !== null && course.discountPrice === 0)) {
      const enrollment = await db.enrollment.create({
        data: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      });

      return NextResponse.json(enrollment, { status: 201 });
    }

    // For paid courses, require payment
    return NextResponse.json(
      { error: "Payment required", redirectTo: `/checkout/${course.slug}` },
      { status: 402 }
    );
  } catch (error) {
    console.error("Error enrolling in course:", error);
    return NextResponse.json(
      { error: "Failed to enroll" },
      { status: 500 }
    );
  }
}
