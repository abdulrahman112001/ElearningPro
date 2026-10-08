"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import toast from "react-hot-toast"
import { useTranslations } from "next-intl"

interface RemoveFromWishlistButtonProps {
  wishlistId: string
}

export function RemoveFromWishlistButton({
  wishlistId,
}: RemoveFromWishlistButtonProps) {
  const router = useRouter()
  const t = useTranslations("courses")
  const [isLoading, setIsLoading] = useState(false)

  const handleRemove = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/wishlist/${wishlistId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove from wishlist")
      }

      toast.success(t("removedFromWishlist"))
      router.refresh()
    } catch (error) {
      toast.error(t("wishlistError"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRemove}
      disabled={isLoading}
      aria-label={t("removeFromWishlist")}
      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  )
}
