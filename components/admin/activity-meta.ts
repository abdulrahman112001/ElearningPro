import {
  Activity,
  AlertTriangle,
  Award,
  BadgeCheck,
  Ban,
  BookOpen,
  BookPlus,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Crown,
  FilePen,
  FilePlus2,
  GraduationCap,
  HelpCircle,
  Layers,
  LogIn,
  MessageCircleReply,
  MessageSquare,
  PenSquare,
  Rocket,
  Send,
  ShieldCheck,
  ShoppingCart,
  Star,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { ActivityAction } from "@/lib/activity"
import type { Tone } from "@/components/shared"

/**
 * Presentation metadata for the admin activity feed. Pure data (no hooks, no
 * "use client"), so both server pages and client components can import it.
 * Labels live in messages under `adminActivity.actions.<group>.<name>`, which
 * matches the action key exactly ("course.published" -> actions.course.published).
 */

export const ACTION_META: Record<ActivityAction, { icon: LucideIcon; tone: Tone }> = {
  "user.registered": { icon: UserPlus, tone: "success" },
  "user.login": { icon: LogIn, tone: "neutral" },
  "user.blocked": { icon: Ban, tone: "danger" },
  "user.unblocked": { icon: ShieldCheck, tone: "success" },
  "user.role_changed": { icon: UserCog, tone: "warning" },
  "user.profile_updated": { icon: PenSquare, tone: "neutral" },
  "course.created": { icon: BookPlus, tone: "primary" },
  "course.updated": { icon: FilePen, tone: "neutral" },
  "course.published": { icon: Rocket, tone: "success" },
  "course.submitted_for_review": { icon: Send, tone: "warning" },
  "course.approved": { icon: BadgeCheck, tone: "success" },
  "course.rejected": { icon: XCircle, tone: "danger" },
  "lesson.created": { icon: FilePlus2, tone: "primary" },
  "lesson.updated": { icon: FilePen, tone: "neutral" },
  "enrollment.created": { icon: GraduationCap, tone: "info" },
  "payment.started": { icon: ShoppingCart, tone: "neutral" },
  "payment.completed": { icon: CreditCard, tone: "success" },
  "subscription.started": { icon: Crown, tone: "neutral" },
  "subscription.activated": { icon: Crown, tone: "success" },
  "quiz.submitted": { icon: ClipboardCheck, tone: "info" },
  "certificate.issued": { icon: Award, tone: "success" },
  "question.asked": { icon: HelpCircle, tone: "warning" },
  "question.answered": { icon: MessageCircleReply, tone: "success" },
  "message.sent": { icon: MessageSquare, tone: "info" },
  "alert.sent": { icon: AlertTriangle, tone: "warning" },
  "group.created": { icon: Users, tone: "primary" },
  "group.updated": { icon: Users, tone: "neutral" },
  "group.deleted": { icon: Trash2, tone: "danger" },
  "group.member_added": { icon: UserPlus, tone: "info" },
  "group.member_removed": { icon: UserMinus, tone: "warning" },
  "grade.created": { icon: Layers, tone: "primary" },
  "grade.updated": { icon: Layers, tone: "neutral" },
  "grade.deleted": { icon: Trash2, tone: "danger" },
  "withdrawal.requested": { icon: Wallet, tone: "warning" },
  "withdrawal.processed": { icon: CheckCircle2, tone: "success" },
  "review.created": { icon: Star, tone: "info" },
  "review.deleted": { icon: Trash2, tone: "danger" },
}

export const ACTIVITY_ACTIONS = Object.keys(ACTION_META) as ActivityAction[]

/** Filter categories; each maps to an action prefix accepted by the API. */
export const ACTIVITY_CATEGORIES = [
  { key: "user", prefix: "user.", icon: Users },
  { key: "course", prefix: "course.", icon: BookOpen },
  { key: "lesson", prefix: "lesson.", icon: FilePlus2 },
  { key: "enrollment", prefix: "enrollment.", icon: GraduationCap },
  { key: "payment", prefix: "payment.", icon: CreditCard },
  { key: "subscription", prefix: "subscription.", icon: Crown },
  { key: "quiz", prefix: "quiz.", icon: ClipboardCheck },
  { key: "certificate", prefix: "certificate.", icon: Award },
  { key: "question", prefix: "question.", icon: HelpCircle },
  { key: "message", prefix: "message.", icon: MessageSquare },
  { key: "alert", prefix: "alert.", icon: AlertTriangle },
  { key: "group", prefix: "group.", icon: Users },
  { key: "grade", prefix: "grade.", icon: Layers },
  { key: "withdrawal", prefix: "withdrawal.", icon: Wallet },
  { key: "review", prefix: "review.", icon: Star },
] as const

export type ActivityCategoryKey = (typeof ACTIVITY_CATEGORIES)[number]["key"]

export const FALLBACK_ACTION_META = { icon: Activity, tone: "neutral" as Tone }

export function getActionMeta(action: string) {
  return ACTION_META[action as ActivityAction] ?? FALLBACK_ACTION_META
}

export function isKnownAction(action: string): action is ActivityAction {
  return action in ACTION_META
}

export interface ActivityItem {
  id: string
  action: string
  actorRole?: string | null
  summary: string | null
  entityType: string | null
  entityId: string | null
  metadata?: unknown
  createdAt: string | Date
  actor: {
    id: string
    name: string | null
    email: string
    role: string
    image: string | null
  } | null
}

/** Admin page that best represents the record an activity row refers to. */
export function activityEntityHref(item: ActivityItem): string | null {
  const { action, entityType, entityId } = item
  if (action === "message.sent" && item.actor && entityId) {
    const [a, b] = [item.actor.id, entityId].sort()
    return `/admin/conversations/${a}/${b}`
  }
  if (action.startsWith("payment.")) return "/admin/payments"
  if (action.startsWith("review.")) return "/admin/reviews"
  switch (entityType) {
    case "course":
      return entityId ? `/admin/courses/${entityId}` : "/admin/courses"
    case "withdrawal":
      return "/admin/withdrawals"
    case "gradeLevel":
      return "/admin/grade-levels"
    case "user":
      return "/admin/users"
    default:
      return null
  }
}

/** Link to the admin users list filtered to one person. */
export function adminUserHref(user: { email?: string | null } | null | undefined) {
  return user?.email ? `/admin/users?search=${encodeURIComponent(user.email)}` : "/admin/users"
}

const intlLocale = (locale: string) => (locale === "en" ? "en-US" : "ar-EG")

/** "3 minutes ago" / "منذ 3 دقائق" with minute granularity. */
export function formatRelativeTime(date: string | Date, locale: string, now = Date.now()) {
  const diffSec = Math.round((new Date(date).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(0, "minute")
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day")
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / (86400 * 7)), "week")
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month")
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year")
}

/** Full date + time, e.g. for tooltips. */
export function formatDateTime(date: string | Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))
}

/** Short time of day (chat bubbles). */
export function formatTime(date: string | Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeStyle: "short" }).format(new Date(date))
}

/** Calendar day label (chat day separators). */
export function formatDay(date: string | Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}

export const ROLE_TONES: Record<string, Tone> = {
  ADMIN: "danger",
  INSTRUCTOR: "info",
  STUDENT: "success",
}
