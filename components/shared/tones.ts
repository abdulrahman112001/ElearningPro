/**
 * Semantic tone palette shared by every building block (stat cards, badges,
 * score bars, empty states). Each tone resolves to theme tokens, so the
 * colours follow light/dark mode automatically. Warning text uses explicit
 * amber shades because amber-on-white fails contrast at body sizes.
 */
export type Tone = "primary" | "success" | "warning" | "info" | "danger" | "neutral"

export const toneStyles: Record<
  Tone,
  {
    /** Tinted square behind an icon */
    icon: string
    /** Soft pill (badge) */
    soft: string
    /** Solid fill (progress bars, dots) */
    solid: string
    /** Foreground text only */
    text: string
  }
> = {
  primary: {
    icon: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
    soft: "bg-primary/10 text-primary border-primary/20",
    solid: "bg-primary",
    text: "text-primary",
  },
  success: {
    icon: "bg-success/10 text-success ring-1 ring-inset ring-success/20",
    soft: "bg-success/10 text-success border-success/20",
    solid: "bg-success",
    text: "text-success",
  },
  warning: {
    icon: "bg-warning/15 text-amber-700 ring-1 ring-inset ring-warning/25 dark:text-amber-400",
    soft: "bg-warning/15 text-amber-800 border-warning/30 dark:text-amber-300",
    solid: "bg-warning",
    text: "text-amber-700 dark:text-amber-400",
  },
  info: {
    icon: "bg-info/10 text-info ring-1 ring-inset ring-info/20",
    soft: "bg-info/10 text-info border-info/20",
    solid: "bg-info",
    text: "text-info",
  },
  danger: {
    icon: "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20",
    soft: "bg-destructive/10 text-destructive border-destructive/20",
    solid: "bg-destructive",
    text: "text-destructive",
  },
  neutral: {
    icon: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    soft: "bg-muted text-muted-foreground border-border",
    solid: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
}
