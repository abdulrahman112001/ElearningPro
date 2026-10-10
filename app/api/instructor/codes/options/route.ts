import { optionsHandler } from "@/lib/codes-api"

export const dynamic = "force-dynamic"

// GET: courses / teachers the caller can create codes for.
export const GET = optionsHandler("instructor")
