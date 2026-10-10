import { createHandler, listHandler } from "@/lib/codes-api"

export const dynamic = "force-dynamic"

// GET: code batches with used/total. POST: create a batch of codes.
export const GET = listHandler("admin")
export const POST = createHandler("admin")
