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
import "@livekit/components-styles"

interface LiveRoomProps {
  classId: string
  classTitle: string
  isHost: boolean
}

export function LiveRoom({ classId, classTitle, isHost }: LiveRoomProps) {
  const t = useTranslations("live")
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(true)
  const [participantCount, setParticipantCount] = useState(0)

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
        throw new Error(data.error || "Failed to join")
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
    if (!confirm(t("confirmEndClass"))) return

    try {
      const response = await fetch(`/api/live/${classId}/end`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to end class")
      }

      toast.success(t("classEnded"))
      router.push("/instructor/live")
    } catch (err: any) {
      toast.error(err.message)
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
            ● LIVE
          </Badge>
          <h1 className="font-semibold">{classTitle}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{participantCount}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>

          {isHost && (
            <Button variant="destructive" onClick={handleEndClass}>
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
        onParticipantsChanged={(participants) => {
          setParticipantCount(participants.length)
        }}
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
