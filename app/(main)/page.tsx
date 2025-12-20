import { Suspense } from "react"
import { HeroSection } from "@/components/home/hero-section"
import { FeaturedCourses } from "@/components/home/featured-courses"
import { CategoriesSection } from "@/components/home/categories-section"
import { StatsSection } from "@/components/home/stats-section"
import { TopInstructors } from "@/components/home/top-instructors"
import { TestimonialsSection } from "@/components/home/testimonials-section"
import { CTASection } from "@/components/home/cta-section"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <StatsSection />
      <Suspense fallback={<LoadingSpinner />}>
        <FeaturedCourses />
      </Suspense>
      <CategoriesSection />
      <Suspense fallback={<LoadingSpinner />}>
        <TopInstructors />
      </Suspense>
      <TestimonialsSection />
      <CTASection />
    </div>
  )
}
