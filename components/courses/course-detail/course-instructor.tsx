"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Star, Users, BookOpen, Award } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface InstructorProps {
  instructor: {
    id: string
    name: string | null
    image?: string | null
    bio?: string | null
    headline?: string | null
    _count: {
      courses: number
    }
  }
}

export function CourseInstructor({ instructor }: InstructorProps) {
  const t = useTranslations("courses")

  return (
    <div className="bg-background rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-4">{t("instructor")}</h2>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Avatar */}
        <Avatar className="h-24 w-24 border-4 border-primary/20">
          <AvatarImage
            src={instructor.image || ""}
            alt={instructor.name || ""}
          />
          <AvatarFallback className="text-2xl">
            {instructor.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1">
          <Link
            href={`/instructors/${instructor.id}`}
            className="text-xl font-semibold hover:text-primary transition-colors"
          >
            {instructor.name}
          </Link>

          {instructor.headline && (
            <p className="text-muted-foreground mt-1">{instructor.headline}</p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400" />
              <span>4.8 {t("instructorRating")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>10,000+ {t("students")}</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>
                {instructor._count.courses} {t("courses")}
              </span>
            </div>
          </div>

          {/* Bio */}
          {instructor.bio && (
            <p className="mt-4 text-muted-foreground leading-relaxed">
              {instructor.bio}
            </p>
          )}

          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/instructors/${instructor.id}`}>
              {t("viewProfile")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
