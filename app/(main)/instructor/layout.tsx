import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { InstructorShell } from "@/components/instructor/instructor-shell"

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/instructor")
  }

  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  // Instructors can only use the dashboard once an admin approves their
  // application; until then they fill it in or wait on its status page.
  if (session.user.role === "INSTRUCTOR" && !session.user.instructorApproved) {
    redirect("/instructor-application")
  }

  return <InstructorShell>{children}</InstructorShell>
}
