"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { ArrowLeft, Star, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatPrice, getInitials } from "@/lib/utils"

// Mock data - will be replaced with real data
const featuredCourses = [
  {
    id: "1",
    titleAr: "دورة تطوير الويب الشاملة",
    titleEn: "Complete Web Development Course",
    slug: "complete-web-development",
    thumbnail: "/images/courses/web-dev.jpg",
    price: 99.99,
    discountPrice: 49.99,
    instructor: { name: "أحمد محمد", image: "" },
    rating: 4.8,
    totalReviews: 1250,
    totalStudents: 5000,
    totalDuration: 1800,
    isBestseller: true,
    isNew: false,
  },
  {
    id: "2",
    titleAr: "تعلم React من الصفر للاحتراف",
    titleEn: "Learn React from Zero to Hero",
    slug: "react-zero-to-hero",
    thumbnail: "/images/courses/react.jpg",
    price: 79.99,
    discountPrice: null,
    instructor: { name: "سارة أحمد", image: "" },
    rating: 4.9,
    totalReviews: 890,
    totalStudents: 3200,
    totalDuration: 1200,
    isBestseller: false,
    isNew: true,
  },
  {
    id: "3",
    titleAr: "دورة تصميم UI/UX الاحترافية",
    titleEn: "Professional UI/UX Design Course",
    slug: "ui-ux-design",
    thumbnail: "/images/courses/design.jpg",
    price: 89.99,
    discountPrice: 59.99,
    instructor: { name: "محمد علي", image: "" },
    rating: 4.7,
    totalReviews: 650,
    totalStudents: 2100,
    totalDuration: 900,
    isBestseller: true,
    isNew: false,
  },
  {
    id: "4",
    titleAr: "الذكاء الاصطناعي وتعلم الآلة",
    titleEn: "AI and Machine Learning",
    slug: "ai-machine-learning",
    thumbnail: "/images/courses/ai.jpg",
    price: 129.99,
    discountPrice: 89.99,
    instructor: { name: "خالد إبراهيم", image: "" },
    rating: 4.6,
    totalReviews: 420,
    totalStudents: 1500,
    totalDuration: 2400,
    isBestseller: false,
    isNew: true,
  },
]

export function FeaturedCourses() {
  const t = useTranslations()

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              {t("course.featured")}
            </h2>
            <p className="text-muted-foreground">{t("course.allCourses")}</p>
          </div>
          <Button variant="outline" asChild className="mt-4 md:mt-0">
            <Link href="/courses">
              {t("common.seeAll")}
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredCourses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={`/course/${course.slug}`}>
                <Card className="h-full overflow-hidden card-hover group">
                  <CardHeader className="p-0">
                    <div className="relative aspect-video bg-muted">
                      {/* Course thumbnail placeholder */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <span className="text-4xl">📚</span>
                      </div>
                      {/* Badges */}
                      <div className="absolute top-2 start-2 flex gap-2">
                        {course.isBestseller && (
                          <Badge variant="bestseller">
                            {t("course.bestseller")}
                          </Badge>
                        )}
                        {course.isNew && (
                          <Badge variant="new">{t("course.new")}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {course.titleAr}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={course.instructor.image} />
                        <AvatarFallback className="text-xs">
                          {getInitials(course.instructor.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {course.instructor.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="ms-1 font-semibold">
                          {course.rating}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        ({course.totalReviews})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {course.totalStudents}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {Math.floor(course.totalDuration / 60)}h
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <div className="flex items-center gap-2">
                      {course.discountPrice ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            {formatPrice(course.discountPrice)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(course.price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {formatPrice(course.price)}
                        </span>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
