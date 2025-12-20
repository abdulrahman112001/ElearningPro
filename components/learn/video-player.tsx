"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  SkipBack,
  SkipForward,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface Lesson {
  id: string
  title: string
  videoUrl?: string | null
  videoProvider?: "YOUTUBE" | "VIMEO" | "UPLOADTHING" | null
  duration?: number | null
}

interface Progress {
  id: string
  watchedSeconds: number
  isCompleted: boolean
}

interface VideoPlayerProps {
  lesson: Lesson
  progress?: Progress | null
  enrollmentId?: string
}

export function VideoPlayer({
  lesson,
  progress,
  enrollmentId,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize from saved progress
  useEffect(() => {
    if (videoRef.current && progress?.watchedSeconds) {
      videoRef.current.currentTime = progress.watchedSeconds
    }
  }, [progress?.watchedSeconds])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlay()
          break
        case "m":
          toggleMute()
          break
        case "f":
          toggleFullscreen()
          break
        case "ArrowLeft":
          e.preventDefault()
          skip(-10)
          break
        case "ArrowRight":
          e.preventDefault()
          skip(10)
          break
        case "ArrowUp":
          e.preventDefault()
          changeVolume(0.1)
          break
        case "ArrowDown":
          e.preventDefault()
          changeVolume(-0.1)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const togglePlay = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    if (document.fullscreenElement) {
      await document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      await containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  const skip = (seconds: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(duration, currentTime + seconds)
    )
  }

  const changeVolume = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta))
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)

    // Update buffered
    const buffered = videoRef.current.buffered
    if (buffered.length > 0) {
      setBuffered(buffered.end(buffered.length - 1))
    }
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
    setIsLoading(false)
  }

  const handleProgress = (value: number[]) => {
    if (!videoRef.current) return
    const newTime = (value[0] / 100) * duration
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const newTime = pos * duration
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleMouseMove = () => {
    setShowControls(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  // Save progress periodically
  useEffect(() => {
    if (!enrollmentId) return

    const interval = setInterval(async () => {
      if (videoRef.current && currentTime > 0) {
        try {
          await fetch(`/api/progress/${lesson.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollmentId,
              watchedSeconds: Math.floor(currentTime),
              isCompleted: currentTime >= duration * 0.9,
            }),
          })
        } catch (error) {
          console.error("Failed to save progress:", error)
        }
      }
    }, 10000) // Save every 10 seconds

    return () => clearInterval(interval)
  }, [lesson.id, enrollmentId, currentTime, duration])

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

  // Render YouTube player
  if (lesson.videoProvider === "YOUTUBE" && lesson.videoUrl) {
    const videoId = extractYouTubeId(lesson.videoUrl)
    return (
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&start=${
            progress?.watchedSeconds || 0
          }`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // Render Vimeo player
  if (lesson.videoProvider === "VIMEO" && lesson.videoUrl) {
    const videoId = extractVimeoId(lesson.videoUrl)
    return (
      <div className="relative w-full aspect-video bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?#t=${
            progress?.watchedSeconds || 0
          }s`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  // Render custom video player
  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={lesson.videoUrl || ""}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onClick={togglePlay}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-12 w-12 animate-spin text-white" />
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors">
            <Play className="h-10 w-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress Bar */}
        <div
          ref={progressBarRef}
          className="relative h-1 bg-white/30 rounded-full mb-4 cursor-pointer group/progress"
          onClick={handleProgressClick}
        >
          {/* Buffered */}
          <div
            className="absolute h-full bg-white/50 rounded-full"
            style={{ width: `${(buffered / duration) * 100}%` }}
          />
          {/* Progress */}
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </Button>

            {/* Skip Back */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => skip(-10)}
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            {/* Skip Forward */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => skip(10)}
            >
              <SkipForward className="h-5 w-5" />
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-2 group/volume">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </Button>
              <div className="w-20 opacity-0 group-hover/volume:opacity-100 transition-opacity">
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="cursor-pointer"
                />
              </div>
            </div>

            {/* Time */}
            <span className="text-white text-sm mr-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Playback Speed */}
            <select
              value={playbackSpeed}
              onChange={(e) => {
                const speed = parseFloat(e.target.value)
                setPlaybackSpeed(speed)
                if (videoRef.current) {
                  videoRef.current.playbackRate = speed
                }
              }}
              className="bg-transparent text-white text-sm border-none outline-none cursor-pointer"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function extractYouTubeId(url: string): string {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : ""
}

function extractVimeoId(url: string): string {
  const regex = /(?:vimeo\.com\/)(\d+)/
  const match = url.match(regex)
  return match ? match[1] : ""
}
