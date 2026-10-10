import { exportHandler } from "@/lib/codes-api"

export const dynamic = "force-dynamic"

// GET: the batch's codes as CSV.
export const GET = exportHandler("admin")
