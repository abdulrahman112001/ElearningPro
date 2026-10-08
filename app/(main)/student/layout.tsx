import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { StudentShell } from "@/components/student/student-shell"

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/student")
  }

  if (session.user.role !== "STUDENT" && session.user.role !== "ADMIN") {
    redirect("/")
  }

  // Sidebar (desktop) + section tabs (mobile) + page container
  return <StudentShell>{children}</StudentShell>
}
