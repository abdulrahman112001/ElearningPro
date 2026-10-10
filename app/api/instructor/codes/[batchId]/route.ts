import { batchPatchHandler, detailHandler } from "@/lib/codes-api"

export const dynamic = "force-dynamic"

// GET: batch with its codes. PATCH { action: "disable" }: disable unused codes.
export const GET = detailHandler("instructor")
export const PATCH = batchPatchHandler("instructor")
