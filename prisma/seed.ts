import {
  PrismaClient,
  CourseLevel,
  CourseStatus,
  UserRole,
} from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // Create admin user
  const adminPassword = await hash("admin123", 12)
  const admin = await prisma.user.upsert({
    where: { email: "admin@elearning.com" },
    update: {},
    create: {
      email: "admin@elearning.com",
      name: "مدير النظام",
      password: adminPassword,
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  })
  console.log("✅ Admin user created:", admin.email)

  // Create instructor users
  const instructorPassword = await hash("instructor123", 12)

  const instructor1 = await prisma.user.upsert({
    where: { email: "ahmed@elearning.com" },
    update: {},
    create: {
      email: "ahmed@elearning.com",
      name: "أحمد محمد",
      password: instructorPassword,
      role: UserRole.INSTRUCTOR,
      emailVerified: new Date(),
      bio: "مطور ويب محترف بخبرة 10 سنوات في تطوير التطبيقات. متخصص في React و Node.js",
      headline: "مطور Full Stack | مدرب معتمد",
    },
  })

  const instructor2 = await prisma.user.upsert({
    where: { email: "sara@elearning.com" },
    update: {},
    create: {
      email: "sara@elearning.com",
      name: "سارة أحمد",
      password: instructorPassword,
      role: UserRole.INSTRUCTOR,
      emailVerified: new Date(),
      bio: "مصممة UI/UX بخبرة 8 سنوات. عملت مع شركات عالمية مثل Google و Microsoft",
      headline: "مصممة واجهات المستخدم | خبيرة Figma",
    },
  })
  console.log("✅ Instructor users created")

  // Create student user
  const studentPassword = await hash("student123", 12)
  const student = await prisma.user.upsert({
    where: { email: "student@elearning.com" },
    update: {},
    create: {
      email: "student@elearning.com",
      name: "محمد علي",
      password: studentPassword,
      role: UserRole.STUDENT,
      emailVerified: new Date(),
    },
  })
  console.log("✅ Student user created:", student.email)

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "web-development" },
      update: {},
      create: {
        nameEn: "Web Development",
        nameAr: "تطوير الويب",
        slug: "web-development",
        description: "تعلم تطوير مواقع وتطبيقات الويب",
        isActive: true,
        position: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: "design" },
      update: {},
      create: {
        nameEn: "Design",
        nameAr: "التصميم",
        slug: "design",
        description: "تعلم تصميم واجهات المستخدم والجرافيك",
        isActive: true,
        position: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: "mobile-development" },
      update: {},
      create: {
        nameEn: "Mobile Development",
        nameAr: "تطوير التطبيقات",
        slug: "mobile-development",
        description: "تعلم تطوير تطبيقات الجوال",
        isActive: true,
        position: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: "data-science" },
      update: {},
      create: {
        nameEn: "Data Science",
        nameAr: "علم البيانات",
        slug: "data-science",
        description: "تعلم تحليل البيانات والذكاء الاصطناعي",
        isActive: true,
        position: 4,
      },
    }),
  ])
  console.log("✅ Categories created:", categories.length)

  // Create courses
  const course1 = await prisma.course.upsert({
    where: { slug: "react-zero-to-hero" },
    update: {},
    create: {
      titleEn: "React from Zero to Hero",
      titleAr: "React من الصفر للاحتراف",
      slug: "react-zero-to-hero",
      descriptionEn:
        "Learn React.js from scratch and become a professional React developer. This comprehensive course covers everything from basics to advanced concepts.",
      descriptionAr:
        "تعلم React.js من الصفر وكن مطور React محترف. هذه الدورة الشاملة تغطي كل شيء من الأساسيات إلى المفاهيم المتقدمة.",
      shortDescEn: "Master React.js and build modern web applications",
      shortDescAr: "أتقن React.js وابنِ تطبيقات ويب حديثة",
      price: 299,
      discountPrice: 199,
      currency: "EGP",
      level: CourseLevel.BEGINNER,
      status: CourseStatus.PUBLISHED,
      language: "AR",
      isFeatured: true,
      isBestseller: true,
      isNew: true,
      averageRating: 4.8,
      totalReviews: 150,
      totalStudents: 500,
      totalLessons: 45,
      totalDuration: 720,
      requirements: [
        "معرفة أساسية بـ HTML و CSS",
        "فهم أساسيات JavaScript",
        "جهاز كمبيوتر مع اتصال إنترنت",
      ],
      whatYouLearn: [
        "فهم مبادئ React الأساسية",
        "بناء تطبيقات React من الصفر",
        "إدارة الحالة باستخدام useState و useReducer",
        "التعامل مع APIs و HTTP Requests",
        "استخدام React Router للتنقل",
        "بناء مشاريع حقيقية",
      ],
      tags: ["react", "javascript", "frontend", "web development"],
      instructorId: instructor1.id,
      categoryId: categories[0].id,
      publishedAt: new Date(),
    },
  })

  const course2 = await prisma.course.upsert({
    where: { slug: "ui-ux-design" },
    update: {},
    create: {
      titleEn: "UI/UX Design Masterclass",
      titleAr: "دورة تصميم UI/UX الشاملة",
      slug: "ui-ux-design",
      descriptionEn:
        "Learn professional UI/UX design from scratch. Master Figma, design principles, and create stunning user interfaces.",
      descriptionAr:
        "تعلم تصميم UI/UX الاحترافي من الصفر. أتقن Figma ومبادئ التصميم وأنشئ واجهات مستخدم مذهلة.",
      shortDescEn: "Become a professional UI/UX designer",
      shortDescAr: "كن مصمم UI/UX محترف",
      price: 399,
      discountPrice: 249,
      currency: "EGP",
      level: CourseLevel.BEGINNER,
      status: CourseStatus.PUBLISHED,
      language: "AR",
      isFeatured: true,
      isBestseller: false,
      isNew: true,
      averageRating: 4.9,
      totalReviews: 85,
      totalStudents: 320,
      totalLessons: 38,
      totalDuration: 600,
      requirements: ["لا يتطلب خبرة سابقة", "جهاز كمبيوتر", "حساب Figma مجاني"],
      whatYouLearn: [
        "أساسيات تصميم واجهات المستخدم",
        "استخدام Figma بشكل احترافي",
        "مبادئ UX وتجربة المستخدم",
        "تصميم تطبيقات الجوال",
        "إنشاء Design Systems",
        "العمل مع المطورين",
      ],
      tags: ["design", "ui", "ux", "figma"],
      instructorId: instructor2.id,
      categoryId: categories[1].id,
      publishedAt: new Date(),
    },
  })

  const course3 = await prisma.course.upsert({
    where: { slug: "nextjs-fullstack" },
    update: {},
    create: {
      titleEn: "Next.js Full Stack Development",
      titleAr: "تطوير Full Stack باستخدام Next.js",
      slug: "nextjs-fullstack",
      descriptionEn:
        "Build full-stack applications with Next.js 14. Learn Server Components, API Routes, Prisma, and more.",
      descriptionAr:
        "ابنِ تطبيقات Full Stack باستخدام Next.js 14. تعلم Server Components و API Routes و Prisma والمزيد.",
      shortDescEn: "Master Next.js 14 and build production-ready apps",
      shortDescAr: "أتقن Next.js 14 وابنِ تطبيقات جاهزة للإنتاج",
      price: 499,
      discountPrice: 349,
      currency: "EGP",
      level: CourseLevel.INTERMEDIATE,
      status: CourseStatus.PUBLISHED,
      language: "AR",
      isFeatured: true,
      isBestseller: true,
      isNew: false,
      averageRating: 4.7,
      totalReviews: 200,
      totalStudents: 650,
      totalLessons: 60,
      totalDuration: 900,
      requirements: [
        "معرفة بـ React",
        "فهم JavaScript ES6+",
        "معرفة أساسية بـ Node.js",
      ],
      whatYouLearn: [
        "إنشاء تطبيقات Next.js من الصفر",
        "استخدام App Router و Server Components",
        "التعامل مع قواعد البيانات باستخدام Prisma",
        "المصادقة والتفويض",
        "Deployment وإطلاق التطبيقات",
        "أفضل الممارسات والتحسينات",
      ],
      tags: ["nextjs", "react", "fullstack", "prisma"],
      instructorId: instructor1.id,
      categoryId: categories[0].id,
      publishedAt: new Date(),
    },
  })

  // Free course
  const course4 = await prisma.course.upsert({
    where: { slug: "html-css-basics" },
    update: {},
    create: {
      titleEn: "HTML & CSS Basics",
      titleAr: "أساسيات HTML و CSS",
      slug: "html-css-basics",
      descriptionEn:
        "Start your web development journey with HTML and CSS fundamentals. Perfect for absolute beginners.",
      descriptionAr:
        "ابدأ رحلتك في تطوير الويب مع أساسيات HTML و CSS. مثالي للمبتدئين تماماً.",
      shortDescEn: "Learn web development basics for free",
      shortDescAr: "تعلم أساسيات تطوير الويب مجاناً",
      price: 0,
      currency: "EGP",
      level: CourseLevel.BEGINNER,
      status: CourseStatus.PUBLISHED,
      language: "AR",
      isFeatured: false,
      isBestseller: false,
      isNew: false,
      averageRating: 4.5,
      totalReviews: 300,
      totalStudents: 1500,
      totalLessons: 25,
      totalDuration: 300,
      requirements: ["لا يتطلب خبرة سابقة", "جهاز كمبيوتر فقط"],
      whatYouLearn: [
        "كتابة كود HTML صحيح",
        "تنسيق الصفحات باستخدام CSS",
        "إنشاء صفحات ويب بسيطة",
        "فهم أساسيات التصميم المتجاوب",
      ],
      tags: ["html", "css", "beginner", "free"],
      instructorId: instructor1.id,
      categoryId: categories[0].id,
      publishedAt: new Date(),
    },
  })

  console.log("✅ Courses created:", 4)

  // Create chapters and lessons for React course
  const chapter1 = await prisma.chapter.create({
    data: {
      titleEn: "Introduction to React",
      titleAr: "مقدمة في React",
      descriptionEn: "Get started with React fundamentals",
      descriptionAr: "ابدأ مع أساسيات React",
      position: 1,
      isPublished: true,
      courseId: course1.id,
    },
  })

  const lessons1 = await Promise.all([
    prisma.lesson.create({
      data: {
        titleEn: "What is React?",
        titleAr: "ما هو React؟",
        descriptionEn: "Introduction to React library",
        descriptionAr: "مقدمة عن مكتبة React",
        position: 1,
        isPublished: true,
        isFree: true,
        videoDuration: 15,
        chapterId: chapter1.id,
      },
    }),
    prisma.lesson.create({
      data: {
        titleEn: "Setting up Development Environment",
        titleAr: "إعداد بيئة التطوير",
        descriptionEn: "Install Node.js and create your first React app",
        descriptionAr: "تثبيت Node.js وإنشاء أول تطبيق React",
        position: 2,
        isPublished: true,
        isFree: true,
        videoDuration: 20,
        chapterId: chapter1.id,
      },
    }),
    prisma.lesson.create({
      data: {
        titleEn: "Understanding JSX",
        titleAr: "فهم JSX",
        descriptionEn: "Learn JSX syntax and its rules",
        descriptionAr: "تعلم صياغة JSX وقواعدها",
        position: 3,
        isPublished: true,
        isFree: false,
        videoDuration: 25,
        chapterId: chapter1.id,
      },
    }),
  ])

  const chapter2 = await prisma.chapter.create({
    data: {
      titleEn: "Components and Props",
      titleAr: "المكونات والخصائص",
      descriptionEn: "Learn about React components and props",
      descriptionAr: "تعلم عن مكونات React والخصائص",
      position: 2,
      isPublished: true,
      courseId: course1.id,
    },
  })

  const lessons2 = await Promise.all([
    prisma.lesson.create({
      data: {
        titleEn: "Functional Components",
        titleAr: "المكونات الوظيفية",
        descriptionEn: "Create and use functional components",
        descriptionAr: "إنشاء واستخدام المكونات الوظيفية",
        position: 1,
        isPublished: true,
        isFree: false,
        videoDuration: 30,
        chapterId: chapter2.id,
      },
    }),
    prisma.lesson.create({
      data: {
        titleEn: "Working with Props",
        titleAr: "العمل مع Props",
        descriptionEn: "Pass data between components using props",
        descriptionAr: "تمرير البيانات بين المكونات باستخدام props",
        position: 2,
        isPublished: true,
        isFree: false,
        videoDuration: 25,
        chapterId: chapter2.id,
      },
    }),
  ])

  console.log("✅ Chapters and lessons created")

  // Create chapters and lessons for UI/UX course
  const uiChapter1 = await prisma.chapter.create({
    data: {
      titleEn: "Introduction to UI/UX",
      titleAr: "مقدمة في UI/UX",
      descriptionEn: "Understanding the basics of UI/UX design",
      descriptionAr: "فهم أساسيات تصميم UI/UX",
      position: 1,
      isPublished: true,
      courseId: course2.id,
    },
  })

  await Promise.all([
    prisma.lesson.create({
      data: {
        titleEn: "What is UI/UX Design?",
        titleAr: "ما هو تصميم UI/UX؟",
        descriptionEn: "Introduction to UI/UX concepts",
        descriptionAr: "مقدمة عن مفاهيم UI/UX",
        position: 1,
        isPublished: true,
        isFree: true,
        videoDuration: 20,
        chapterId: uiChapter1.id,
      },
    }),
    prisma.lesson.create({
      data: {
        titleEn: "Getting Started with Figma",
        titleAr: "البدء مع Figma",
        descriptionEn: "Set up your Figma account and workspace",
        descriptionAr: "إعداد حسابك ومساحة العمل في Figma",
        position: 2,
        isPublished: true,
        isFree: true,
        videoDuration: 25,
        chapterId: uiChapter1.id,
      },
    }),
  ])

  // Create enrollments
  await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course1.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      courseId: course1.id,
    },
  })

  await prisma.enrollment.upsert({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course4.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      courseId: course4.id,
    },
  })
  console.log("✅ Enrollments created")

  // Create reviews
  await prisma.review.upsert({
    where: {
      userId_courseId: {
        userId: student.id,
        courseId: course1.id,
      },
    },
    update: {},
    create: {
      rating: 5,
      comment:
        "كورس ممتاز! شرح واضح ومفصل. أنصح به بشدة لكل من يريد تعلم React",
      userId: student.id,
      courseId: course1.id,
    },
  })
  console.log("✅ Reviews created")

  console.log("\n🎉 Database seeded successfully!")
  console.log("\n📧 Test accounts:")
  console.log("   Admin: admin@elearning.com / admin123")
  console.log("   Instructor: ahmed@elearning.com / instructor123")
  console.log("   Instructor: sara@elearning.com / instructor123")
  console.log("   Student: student@elearning.com / student123")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
