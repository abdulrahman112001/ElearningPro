import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { loadReceipt } from "@/lib/fees"
import { FeeReceipt } from "@/components/fees/fee-receipt"

export async function generateMetadata() {
  const t = await getTranslations("fees.receiptPage")
  return { title: t("title") }
}

export default async function GroupFeeReceiptPage({ params }: { params: { groupId: string; feeId: string } }) {
  const session = await auth()
  if (!session?.user) return null
  const fee = await loadReceipt(params.feeId, session.user)
  if (!fee || fee.groupId !== params.groupId || fee.status !== "PAID") notFound()
  return <FeeReceipt fee={fee} backHref={`/instructor/groups/${params.groupId}/fees?period=${fee.period}`} />
}
