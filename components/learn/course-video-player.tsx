"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import ReactPlayer from "react-player"
import { useLocale, useTranslations } from "next-intl"
import toast from "react-hot-toast"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  SkipForward,
  CheckCircle,
  Loader2,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MovingWatermark } from "@/components/video-protection/moving-watermark"
import { PlaybackBlocked } from "@/components/video-protection/playback-blocked"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface PlayData {
  videoUrl: string
  videoProvider?: string | null
  viewsUsed: number
  viewsAllowed: number | null
  watermark: { enabled: boolean; text: string }
}

type PlaybackState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; data: PlayData }
  | { status: "blocked"; code: string; details: Record<string, any> }

interface VideoPlayerProps {
  lesson: {
    id: string
    titleEn: string
    titleAr?: string | null
    /** The URL itself is fetched from /api/lessons/[id]/play. */
    hasVideo: boolean
    videoDuration?: number
  }
  progress?: {
    isCompleted: boolean
    watchedTime: number
  } | null
  userId: string
  courseSlug: string
  nextLesson?: {
    id: string
    titleEn: string
    titleAr?: string | null
  } | null
}

export function VideoPlayer({
  lesson,
  progress,
  userId,
  courseSlug,
  nextLesson,
}: VideoPlayerProps) {
  const router = useRouter()
  const t = useTranslations("videoPlayer")
  const tLearn = useTranslations("learn")
  const locale = useLocale()
  const playerRef = useRef<ReactPlayer>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [played, setPlayed] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCompleted, setIsCompleted] = useState(progress?.isCompleted || false)
  const [isSavingProgress, setIsSavingProgress] = useState(false)
  const tv = useTranslations("videoProtection")
  const [playback, setPlayback] = useState<PlaybackState>(
    lesson.hasVideo ? { status: "loading" } : { status: "none" }
  )

  // Video protection: the URL comes from the play API, which counts the view
  // and checks the device limit.
  const loadPlayback = async () => {
    setPlayback({ status: "loading" })
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/play`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPlayback({ status: "ready", data })
      } else {
        setPlayback({ status: "blocked", code: data.code || "error", details: data })
      }
    } catch {
      setPlayback({ status: "blocked", code: "error", details: {} })
    }
  }

  useEffect(() => {
    if (lesson.hasVideo) loadPlayback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.hasVideo])

  // Keep the button state right when fullscreen is left with Esc.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return

    const timer = setTimeout(() => {
      if (playing) {
        setShowControls(false)
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [showControls, playing])

  // Save progress periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (playing && duration > 0) {
        saveProgress(played * duration, false)
      }
    }, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [playing, played, duration])

  // Mark as complete when 90% watched
  useEffect(() => {
    if (!isCompleted && played > 0.9 && duration > 0) {
      markAsComplete()
    }
  }, [played, isCompleted, duration])

  const saveProgress = async (watchedSeconds: number, completed: boolean) => {
    setIsSavingProgress(true)
    try {
      await fetch("/api/progress/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          watchedDuration: Math.floor(watchedSeconds),
          completed,
        }),
      })
    } catch (error) {
      console.error("Failed to save progress:", error)
    } finally {
      setIsSavingProgress(false)
    }
  }

  const markAsComplete = async () => {
    setIsCompleted(true)
    await saveProgress(duration, true)
    toast.success(tLearn("lessonCompleted"))

    // Show next lesson prompt after 2 seconds
    if (nextLesson) {
      const nextTitle =
        locale === "ar"
          ? nextLesson.titleAr || nextLesson.titleEn
          : nextLesson.titleEn || nextLesson.titleAr
      setTimeout(() => {
        toast(
          (tt) => (
            <span className="flex items-center gap-3">
              <span>{t("continueTo", { title: nextTitle ?? "" })}</span>
              <button
                type="button"
                className="shrink-0 rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  toast.dismiss(tt.id)
                  router.push(`/courses/${courseSlug}/learn/${nextLesson.id}`)
                }}
              >
                {tLearn("nextLesson")}
              </button>
            </span>
          ),
          { duration: 10000 }
        )
      }, 2000)
    }
  }

  const togglePlay = () => setPlaying(!playing)

  const toggleMute = () => setMuted(!muted)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleProgress = (state: any) => {
    setPlayed(state.played)
    setLoaded(state.loaded)
  }

  const handleSeek = (value: number[]) => {
    const newPlayed = value[0] / 100
    setPlayed(newPlayed)
    playerRef.current?.seekTo(newPlayed)
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`
    }
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (playback.status === "none") {
    return (
      <div className="aspect-video bg-black flex items-center justify-center">
        <p className="text-white">{t("noVideo")}</p>
      </div>
    )
  }

  if (playback.status === "loading") {
    return (
      <div className="aspect-video bg-black flex items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <span className="sr-only">{tv("loading")}</span>
      </div>
    )
  }

  if (playback.status === "blocked") {
    return (
      <PlaybackBlocked
        code={playback.code}
        details={playback.details}
        onRetry={loadPlayback}
      />
    )
  }

  const { data: play } = playback
  const viewsLeft =
    play.viewsAllowed != null ? Math.max(0, play.viewsAllowed - play.viewsUsed) : null

  return (
    <div
      ref={containerRef}
      className="relative bg-black group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactPlayer
        ref={playerRef}
        url={play.videoUrl}
        width="100%"
        height="100%"
        className="aspect-video"
        playing={playing}
        volume={volume}
        muted={muted}
        playbackRate={playbackRate}
        onProgress={handleProgress}
        onDuration={setDuration}
        onEnded={() => {
          setPlaying(false)
          if (!isCompleted) {
            markAsComplete()
          }
        }}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              // Fullscreen goes through our wrapper so the watermark stays on top.
              fs: 0,
              disablekb: 1,
            },
          },
          vimeo: {
            playerOptions: {
              byline: false,
              portrait: false,
              title: false,
            },
          },
          file: {
            attributes: {
              controlsList: "nodownload noremoteplayback",
              disablePictureInPicture: true,
              onContextMenu: (e: Event) => e.preventDefault(),
            },
          },
        }}
      />

      {/* Moving name/phone watermark (stays in fullscreen: it is inside the wrapper) */}
      {play.watermark.enabled && <MovingWatermark text={play.watermark.text} />}

      {/* Remaining views */}
      {viewsLeft !== null && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-24 start-4 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
          data-testid="views-left"
        >
          <Eye className="h-3.5 w-3.5" />
          {tv("viewsLeft", { left: viewsLeft, total: play.viewsAllowed ?? 0 })}
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Completion Badge */}
        {isCompleted && (
          <div className="absolute top-4 end-4 bg-green-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            {tLearn("completed")}
          </div>
        )}

        {/* Saving Indicator */}
        {isSavingProgress && (
          <div className="absolute top-4 start-4 bg-black/60 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("saving")}
          </div>
        )}

        {/* Center Play Button */}
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={t("play")}
          >
            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
              <Play className="h-10 w-10 text-black ms-1" />
            </div>
          </button>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 start-0 end-0 p-4 space-y-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <Slider
              value={[played * 100]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="flex-1"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
                aria-label={playing ? t("pause") : t("play")}
              >
                {playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              {/* Skip Forward 10s */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  playerRef.current?.seekTo(played + 10 / duration)
                }
                className="text-white hover:bg-white/20"
                aria-label={t("skipForward")}
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                  aria-label={muted || volume === 0 ? t("unmute") : t("mute")}
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[muted ? 0 : volume * 100]}
                  onValueChange={([v]) => {
                    setVolume(v / 100)
                    setMuted(false)
                  }}
                  max={100}
                  className="w-20"
                />
              </div>

              {/* Time */}
              <span className="text-sm">
                {formatTime(played * duration)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    aria-label={t("playbackSpeed")}
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={rate === playbackRate ? "bg-accent" : ""}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
                aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
