import { redirect } from "next/navigation"

interface CoursePageProps {
  params: {
    slug: string
  }
}

// Redirect /course/[slug] to /courses/[slug]
export default function CourseRedirectPage({ params }: CoursePageProps) {
  redirect(`/courses/${params.slug}`)
}
