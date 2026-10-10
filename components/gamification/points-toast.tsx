"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"

export interface GamificationPayload {
  points?: number
  badges?: string[]
  streak?: number
}

/**
 * Shows "+N points" / "New badge" toasts for the `gamification` object that
 * progress, quiz and homework APIs return.
 *
 * @example
 * const notify = useGamificationToast()
 * const data = await res.json()
 * notify(data.gamification)
 */
export function useGamificationToast() {
  const t = useTranslations("gamification")
  return useCallback(
    (payload?: GamificationPayload | null) => {
      if (!payload) return
      if (payload.points && payload.points > 0) {
        toast.success(t("toastPoints", { count: payload.points }), { icon: "⭐" })
      }
      for (const key of payload.badges ?? []) {
        toast.success(t("toastBadge", { name: t(`badges.${key}.name`) }), { icon: "🏅", duration: 5000 })
      }
    },
    [t]
  )
}
