import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-error"
import { loadReceipt } from "@/lib/fees"

// GET /api/fees/:feeId: receipt data, for the student who owns the fee and
// for whoever manages its group.
export async function GET(request: Request, { params }: { params: { feeId: string } }) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const receipt = await loadReceipt(params.feeId, session.user)
    if (!receipt) return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    return NextResponse.json(receipt)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Get fee error:", error)
    return NextResponse.json({ error: "Failed to load the fee" }, { status: 500 })
  }
}
