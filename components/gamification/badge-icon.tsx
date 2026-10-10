import {
  Award,
  BookOpen,
  Brain,
  ClipboardCheck,
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  Library,
  Medal,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  Award,
  BookOpen,
  Brain,
  ClipboardCheck,
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  Library,
  Target,
  Zap,
}

/** Lucide icon stored on a Badge row (falls back to a medal). */
export function BadgeIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Medal
  return <Icon className={cn("h-6 w-6", className)} aria-hidden="true" />
}
