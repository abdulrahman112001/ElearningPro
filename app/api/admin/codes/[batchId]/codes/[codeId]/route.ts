import { codePatchHandler } from "@/lib/codes-api"

// PATCH { disabled }: enable/disable one unused code.
export const PATCH = codePatchHandler("admin")
