"use client"

import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Star, Users, PlayCircle } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Course {
  id: string
  titleEn: string
  titleAr?: string
  slug: string
  thumbnail?: string | null
  price: number
  discountPrice?: number | null
  averageRating: number
  instructor: {
    id: string
    name: string | null
    image?: string | null
  }
  _count: {
    enrollments: number
    reviews: number
  }
}

interface RelatedCoursesProps {
  courses: Course[]
}

export function RelatedCourses({ courses }: RelatedCoursesProps) {
  const t = useTranslations("courses")

  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold mb-6">{t("relatedCourses")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/courses/${course.slug}`}>
              <Card className="h-full overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={course.titleEn}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <PlayCircle className="h-10 w-10 text-primary/50" />
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {course.titleAr || course.titleEn}
                  </h3>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">
                        {course.averageRating.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      ({course._count.reviews})
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={course.instructor.image || ""} />
                      <AvatarFallback className="text-xs">
                        {course.instructor.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                      {course.instructor.name}
                    </span>
                  </div>

                  <div>
                    {course.price === 0 ? (
                      <span className="font-bold text-green-600">
                        {t("free")}
                      </span>
                    ) : (
                      <span className="font-bold">
                        {(course.discountPrice || course.price).toFixed(0)} ج.م
                      </span>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
