import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Create a review
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

    const body = await request.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if user is enrolled
    const enrollment = await db.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "You must be enrolled to review this course" },
        { status: 403 }
      );
    }

    // Check for existing review
    const existingReview = await db.review.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId: params.courseId,
        },
      },
    });

    if (existingReview) {
      // Update existing review
      const review = await db.review.update({
        where: { id: existingReview.id },
        data: { rating, comment },
      });

      // Update course average rating
      await updateCourseRating(params.courseId);

      return NextResponse.json(review);
    }

    // Create new review
    const review = await db.review.create({
      data: {
        userId: session.user.id,
        courseId: params.courseId,
        rating,
        comment,
        status: "APPROVED", // Auto-approve for now
      },
    });

    // Update course average rating
    await updateCourseRating(params.courseId);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}

// GET - Fetch course reviews
export async function GET(
  request: Request,
  { params }: { params: { courseId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where: {
          courseId: params.courseId,
          status: "APPROVED",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.review.count({
        where: {
          courseId: params.courseId,
          status: "APPROVED",
        },
      }),
    ]);

    return NextResponse.json({
      reviews,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

async function updateCourseRating(courseId: string) {
  const result = await db.review.aggregate({
    where: {
      courseId,
      status: "APPROVED",
    },
    _avg: {
      rating: true,
    },
    _count: true,
  });

  await db.course.update({
    where: { id: courseId },
    data: {
      averageRating: result._avg.rating || 0,
      totalReviews: result._count,
    },
  });
}
