"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
  Chat,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { Loader2, Users, MessageCircle, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import "@livekit/components-styles"

interface LiveRoomProps {
  classId: string
  classTitle: string
  isHost: boolean
}

export function LiveRoom({ classId, classTitle, isHost }: LiveRoomProps) {
  const t = useTranslations("live")
  const tRoom = useTranslations("liveRoom")
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(true)
  const [showEndDialog, setShowEndDialog] = useState(false)

  useEffect(() => {
    joinRoom()
  }, [classId])

  const joinRoom = async () => {
    try {
      const endpoint = isHost
        ? `/api/live/${classId}/start`
        : `/api/live/${classId}/join`

      const response = await fetch(endpoint, {
        method: "POST",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || tRoom("joinFailed"))
      }

      const data = await response.json()
      setToken(data.token)
      setWsUrl(data.wsUrl)
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndClass = async () => {
    setShowEndDialog(false)
    try {
      const response = await fetch(`/api/live/${classId}/end`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(tRoom("endFailed"))
      }

      toast.success(t("classEnded"))
      router.push("/instructor/live")
    } catch (err: any) {
      toast.error(err.message || tRoom("endFailed"))
    }
  }

  const handleDisconnected = () => {
    if (!isHost) {
      toast.error(t("classEnded"))
      router.push("/student")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("joiningClass")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => router.back()}>{t("goBack")}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!token || !wsUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">{t("noConnection")}</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="animate-pulse">
            ● {tRoom("liveBadge")}
          </Badge>
          <h1 className="font-semibold">{classTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChat(!showChat)}
            aria-label={showChat ? tRoom("hideChat") : tRoom("showChat")}
            aria-pressed={showChat}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>

          {isHost && (
            <Button variant="destructive" onClick={() => setShowEndDialog(true)}>
              {t("endClass")}
            </Button>
          )}
        </div>
      </div>

      {/* LiveKit Room */}
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        connect={true}
        video={isHost}
        audio={isHost}
        onDisconnected={handleDisconnected}
        className="flex-1 flex"
        data-lk-theme="default"
      >
        <div className="flex-1 flex">
          {/* Video Area */}
          <div className="flex-1">
            <VideoConference />
          </div>

          {/* Chat Sidebar */}
          {showChat && (
            <div className="w-80 border-r bg-background">
              <Chat />
            </div>
          )}
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>

      {/* End class confirmation */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("endClass")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmEndClass")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndClass}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("endClass")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Custom video grid component
function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  )

  return (
    <GridLayout tracks={tracks} className="h-full">
      <ParticipantTile />
    </GridLayout>
  )
}
