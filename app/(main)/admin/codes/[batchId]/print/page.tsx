import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PrintCards } from "@/components/codes/print-cards"

export const dynamic = "force-dynamic"

export default async function PrintCodesPage({ params }: { params: { batchId: string } }) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <PrintCards
      scope="admin"
      batchId={params.batchId}
      actor={{ id: session.user.id, role: session.user.role }}
    />
  )
}
