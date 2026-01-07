/*
  End-to-end DB cycle (no browser):
  - Instructor creates + publishes a full course (chapters/lessons/attachments/quiz)
  - Student purchases + enrolls
  - Student completes lessons + passes quiz
  - Enrollment marked completed + certificate issued
  - Admin analytics sanity numbers printed

  Run:
    node scripts/run-cycle.js
*/

const { PrismaClient, PaymentProvider, PaymentStatus, CourseStatus, CourseLevel, UserRole, VideoProvider } = require("@prisma/client");

const prisma = new PrismaClient();

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeOption(textEn, textAr, isCorrect) {
  return {
    id: `opt_${Math.random().toString(36).slice(2, 10)}`,
    text: textEn,
    textAr,
    isCorrect,
  };
}

async function main() {
  console.log("\n🔁 Running full platform cycle...");

  const [admin, instructor, student] = await Promise.all([
    prisma.user.findFirst({ where: { role: UserRole.ADMIN } }),
    prisma.user.findFirst({ where: { role: UserRole.INSTRUCTOR } }),
    prisma.user.findFirst({ where: { role: UserRole.STUDENT } }),
  ]);

  if (!admin || !instructor || !student) {
    throw new Error(
      "Missing seeded users. Run: npx prisma db seed (must create admin/instructor/student)."
    );
  }

  const category = await prisma.category.findFirst({ where: { isActive: true } });
  if (!category) throw new Error("No category found. Seed categories first.");

  const now = Date.now();
  const titleEn = `Cycle Course ${now}`;
  const titleAr = `كورس السايكل ${now}`;
  const slug = slugify(`${titleEn}-${now}`);

  // 1) Instructor creates + publishes course
  const course = await prisma.course.create({
    data: {
      titleEn,
      titleAr,
      slug,
      descriptionEn: "A complete course created by the cycle script.",
      descriptionAr: "كورس كامل تم إنشاؤه بواسطة سكربت السايكل.",
      shortDescEn: "Cycle course",
      shortDescAr: "كورس سايكل",
      thumbnail: "/uploads/course-thumbnail.png",
      promoVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      promoVideoType: VideoProvider.YOUTUBE,
      price: 49,
      discountPrice: 29,
      currency: "USD",
      level: CourseLevel.ALL_LEVELS,
      status: CourseStatus.PUBLISHED,
      publishedAt: new Date(),
      requirements: ["Basic computer skills"],
      whatYouLearn: ["How the platform works end-to-end"],
      tags: ["cycle", "smoke"],
      language: "ar",
      subtitles: ["ar", "en"],
      instructorId: instructor.id,
      categoryId: category.id,
      totalDuration: 60,
      totalLessons: 3,
    },
  });

  const chapter1 = await prisma.chapter.create({
    data: {
      courseId: course.id,
      titleEn: "Getting Started",
      titleAr: "البداية",
      position: 1,
      isPublished: true,
      isFree: false,
    },
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      chapterId: chapter1.id,
      titleEn: "Welcome",
      titleAr: "مرحباً",
      descriptionEn: "Intro lesson",
      descriptionAr: "درس مقدمة",
      position: 1,
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoProvider: VideoProvider.YOUTUBE,
      videoDuration: 120,
      isPublished: true,
      isFree: false,
      isPreview: true,
    },
  });

  const lesson2 = await prisma.lesson.create({
    data: {
      chapterId: chapter1.id,
      titleEn: "Resources",
      titleAr: "الموارد",
      descriptionEn: "Attachments lesson",
      descriptionAr: "درس ملفات",
      position: 2,
      isPublished: true,
      isFree: false,
    },
  });

  await prisma.attachment.create({
    data: {
      lessonId: lesson2.id,
      name: "Sample PDF",
      url: "/uploads/sample.pdf",
      type: "pdf",
      size: 1024 * 200,
    },
  });

  const lesson3 = await prisma.lesson.create({
    data: {
      chapterId: chapter1.id,
      titleEn: "Final Quiz",
      titleAr: "الاختبار النهائي",
      position: 3,
      isPublished: true,
      isFree: false,
    },
  });

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson3.id,
      title: "Final Quiz",
      titleAr: "الاختبار النهائي",
      description: "Pass to complete",
      passingScore: 70,
      timeLimit: 10,
      shuffleQuestions: false,
      showResults: true,
    },
  });

  const q1Options = [
    makeOption("1", "١", false),
    makeOption("2", "٢", true),
    makeOption("3", "٣", false),
  ];

  const question1 = await prisma.quizQuestion.create({
    data: {
      quizId: quiz.id,
      question: "What is 1 + 1?",
      questionAr: "كم يساوي ١ + ١؟",
      type: "MULTIPLE_CHOICE",
      options: q1Options,
      explanation: "1 + 1 = 2",
      explanationAr: "١ + ١ = ٢",
      points: 1,
      position: 1,
    },
  });

  // 2) Student purchases + enrolls
  const amount = course.discountPrice ?? course.price;
  await prisma.purchase.create({
    data: {
      userId: student.id,
      courseId: course.id,
      amount,
      currency: course.currency,
      provider: PaymentProvider.STRIPE,
      providerId: `cycle_${now}`,
      status: PaymentStatus.COMPLETED,
      instructorShare: amount * 0.7,
      platformShare: amount * 0.3,
    },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      courseId: course.id,
    },
  });

  // 3) Student completes lessons
  const lessons = [lesson1, lesson2, lesson3];
  for (const lesson of lessons) {
    await prisma.progress.upsert({
      where: {
        userId_lessonId: {
          userId: student.id,
          lessonId: lesson.id,
        },
      },
      update: {
        watchedTime: 999,
        isCompleted: true,
        completedAt: new Date(),
      },
      create: {
        userId: student.id,
        lessonId: lesson.id,
        watchedTime: 999,
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }

  // 4) Student passes quiz (create attempt + answers)
  const correctOption = q1Options.find((o) => o.isCorrect);
  await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: student.id,
      score: 100,
      passed: true,
      startedAt: new Date(Date.now() - 60 * 1000),
      completedAt: new Date(),
      timeSpent: 45,
      answers: {
        create: [
          {
            questionId: question1.id,
            answer: correctOption ? correctOption.id : null,
            isCorrect: true,
            points: 1,
          },
        ],
      },
    },
  });

  // 5) Mark enrollment complete (match backend expectations)
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: 100,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  // 6) Issue certificate (same model as API expects)
  const existingCert = await prisma.certificate.findUnique({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course.id,
      },
    },
  });

  const certificate =
    existingCert ||
    (await prisma.certificate.create({
      data: {
        certificateNo: `CERT-${now}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        userId: student.id,
        courseId: course.id,
        completedAt: new Date(),
        grade: 100,
      },
    }));

  // 7) Admin analytics sanity check (subset)
  const [totalUsers, totalCourses, totalEnrollments, totalRevenue] =
    await Promise.all([
      prisma.user.count(),
      prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
      prisma.enrollment.count(),
      prisma.purchase.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
    ]);

  console.log("\n✅ Cycle completed");
  console.log({
    createdCourse: { id: course.id, slug: course.slug },
    student: { id: student.id, email: student.email },
    enrollment: { id: enrollment.id, progress: 100 },
    certificate: { id: certificate.id, certificateNo: certificate.certificateNo },
    adminAnalytics: {
      totalUsers,
      publishedCourses: totalCourses,
      totalEnrollments,
      totalRevenue: totalRevenue._sum.amount || 0,
    },
  });

  console.log("\nNext manual UI checks:");
  console.log(`- Instructor dashboard: /instructor`);
  console.log(`- Course page: /courses/${course.slug}`);
  console.log(`- Student dashboard: /student`);
  console.log(`- Certificate page: /student/certificates (or certificate verification if exists)`);
  console.log(`- Admin analytics: /admin/analytics`);
}

main()
  .catch((e) => {
    console.error("\n❌ Cycle failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
