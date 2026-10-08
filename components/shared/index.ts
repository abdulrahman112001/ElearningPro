/**
 * Shared design-system building blocks. Import from "@/components/shared".
 * None of these are client components, so they work in server pages too.
 */
export { PageHeader, type PageHeaderProps, type BreadcrumbItem } from "./page-header"
export { StatCard, type StatCardProps } from "./stat-card"
export { SectionCard, type SectionCardProps } from "./section-card"
export { EmptyState, type EmptyStateProps } from "./empty-state"
export {
  CardSkeleton,
  StatSkeleton,
  StatGridSkeleton,
  TableSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
} from "./skeletons"
export { AvatarName, type AvatarNameProps } from "./avatar-name"
export {
  StatusBadge,
  statusTone,
  normalizeStatus,
  type StatusBadgeProps,
} from "./status-badge"
export { ScoreBar, scoreTone, type ScoreBarProps } from "./score-bar"
export { toneStyles, type Tone } from "./tones"
