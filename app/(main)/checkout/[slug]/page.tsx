import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CheckoutForm } from "@/components/checkout/checkout-form";

interface CheckoutPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: CheckoutPageProps) {
  const t = await getTranslations("checkout");
  return {
    title: t("checkout"),
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const session = await auth();
  const t = await getTranslations("checkout");

  if (!session?.user) {
    redirect(`/login?callbackUrl=/checkout/${params.slug}`);
  }

  const course = await db.course.findUnique({
    where: { 
      slug: params.slug,
      status: "PUBLISHED",
    },
    include: {
      instructor: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  // Check if already enrolled
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: course.id,
      },
    },
  });

  if (enrollment) {
    redirect(`/courses/${course.slug}/learn`);
  }

  // For free courses, redirect to enroll
  if (course.price === 0) {
    redirect(`/courses/${course.slug}`);
  }

  const finalPrice = course.discountPrice !== null && course.discountPrice < course.price
    ? course.discountPrice
    : course.price;

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-8">{t("checkout")}</h1>
        
        <CheckoutForm 
          course={course}
          finalPrice={finalPrice}
        />
      </div>
    </div>
  );
}
