import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ParentShell } from "@/components/parent/parent-shell"

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login?callbackUrl=/parent")
  if (session.user.role !== "PARENT" && session.user.role !== "ADMIN") redirect("/")
  return <ParentShell>{children}</ParentShell>
}
