"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import toast from "react-hot-toast"

interface RemoveFromWishlistButtonProps {
  wishlistId: string
}

export function RemoveFromWishlistButton({
  wishlistId,
}: RemoveFromWishlistButtonProps) {
  const router = useRouter()
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

      toast.success("تم الإزالة من المفضلة")
      router.refresh()
    } catch (error) {
      toast.error("حدث خطأ أثناء الإزالة")
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
      className="text-red-500 hover:text-red-600 hover:bg-red-50"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  )
}
