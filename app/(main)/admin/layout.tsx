import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminShell } from "@/components/admin/admin-sidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/")
  }

  // Sidebar (desktop) + section tabs (mobile) + page container
  return <AdminShell>{children}</AdminShell>
}
