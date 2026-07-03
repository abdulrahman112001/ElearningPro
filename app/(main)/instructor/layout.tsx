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

  return <InstructorShell>{children}</InstructorShell>
}
