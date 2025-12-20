"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import ReactPlayer from "react-player"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface VideoPlayerProps {
  lesson: {
    id: string
    title: string
    videoUrl?: string
    videoProvider?: string
    duration?: number
  }
  progress?: {
    completed: boolean
    watchedDuration: number
  } | null
  userId: string
  courseSlug: string
  nextLesson?: {
    id: string
    title: string
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
  const [isCompleted, setIsCompleted] = useState(progress?.completed || false)
  const [isSavingProgress, setIsSavingProgress] = useState(false)

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
    toast.success("Lesson completed!")

    // Show next lesson prompt after 2 seconds
    if (nextLesson) {
      setTimeout(() => {
        const proceed = confirm(`Continue to: ${nextLesson.titleEn}?`)
        if (proceed) {
          router.push(`/courses/${courseSlug}/learn/${nextLesson.id}`)
        }
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

  if (!lesson.videoUrl) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center">
        <p className="text-white">No video available for this lesson</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <ReactPlayer
        ref={playerRef}
        url={lesson.videoUrl}
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
            },
          },
          vimeo: {
            playerOptions: {
              byline: false,
              portrait: false,
              title: false,
            },
          },
        }}
      />

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Completion Badge */}
        {isCompleted && (
          <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed
          </div>
        )}

        {/* Saving Indicator */}
        {isSavingProgress && (
          <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}

        {/* Center Play Button */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors">
              <Play className="h-10 w-10 text-black ml-1" />
            </div>
          </button>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
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
