import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/instructor-guard"
import { apiErrorResponse } from "@/lib/api-error"
import { queryDeliveries } from "@/lib/reports/deliveries"

/** Delivery log with filters: ?channel=&template=&status=&page= */
export async function GET(request: Request) {
  try {
    const guard = await requireAdmin()
    if (guard.error) return guard.error
    const sp = new URL(request.url).searchParams
    const result = await queryDeliveries({
      channel: sp.get("channel"),
      template: sp.get("template"),
      status: sp.get("status"),
      page: Number(sp.get("page") ?? 1),
    })
    return NextResponse.json(result)
  } catch (error) {
    const handled = apiErrorResponse(error)
    if (handled) return handled
    console.error("Admin messaging error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
