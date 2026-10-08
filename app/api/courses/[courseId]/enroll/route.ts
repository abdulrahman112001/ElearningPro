import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error"
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveTeacherSubscription, isInClassGroup } from "@/lib/access";
import { logActivity } from "@/lib/activity";

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

    if (existingEnrollment && !existingEnrollment.viaSubscription) {
      return NextResponse.json(
        { error: "Already enrolled" },
        { status: 400 }
      );
    }

    // Courses attached to a teacher's class group are for its members only.
    if (!(await isInClassGroup(session.user.id, course.classGroupId))) {
      return NextResponse.json(
        { error: "This course is only available to the teacher's group members", code: "group_only" },
        { status: 403 }
      );
    }

    // For free courses, enroll directly
    if (course.price === 0 || (course.discountPrice !== null && course.discountPrice === 0)) {
      const enrollment = await db.enrollment.upsert({
        where: { userId_courseId: { userId: session.user.id, courseId: params.courseId } },
        update: { viaSubscription: false },
        create: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      });

      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "enrollment.created",
        entityType: "course",
        entityId: course.id,
        summary: `Enrolled in free course "${course.titleEn}"`,
      });

      return NextResponse.json(enrollment, { status: 201 });
    }

    // Paid course covered by an active subscription to its teacher
    const subscription = await getActiveTeacherSubscription(session.user.id, course.instructorId);
    if (subscription) {
      const enrollment = await db.enrollment.upsert({
        where: { userId_courseId: { userId: session.user.id, courseId: params.courseId } },
        update: {},
        create: { userId: session.user.id, courseId: params.courseId, viaSubscription: true },
      });

      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "enrollment.created",
        entityType: "course",
        entityId: course.id,
        summary: `Enrolled via teacher subscription in "${course.titleEn}"`,
        metadata: { subscriptionId: subscription.id },
      });

      return NextResponse.json({ ...enrollment, via: "subscription" }, { status: 201 });
    }

    // For paid courses, require payment
    return NextResponse.json(
      { error: "Payment required", redirectTo: `/checkout/${course.slug}` },
      { status: 402 }
    );
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Error enrolling in course:", error);
    return NextResponse.json(
      { error: "Failed to enroll" },
      { status: 500 }
    );
  }
}
