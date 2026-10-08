/** Status tabs on the admin instructors page (shared by the server page and the client table). */
export const INSTRUCTOR_STATUS_TABS = ["all", "pending", "draft", "approved", "rejected"] as const
export type InstructorStatusTab = (typeof INSTRUCTOR_STATUS_TABS)[number]

export function isInstructorStatusTab(value: unknown): value is InstructorStatusTab {
  return typeof value === "string" && (INSTRUCTOR_STATUS_TABS as readonly string[]).includes(value)
}
