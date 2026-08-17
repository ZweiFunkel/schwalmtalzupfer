'use client'
import React, { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface YouTubePlayerProps {
  videoId: string
  onReady?: (player: any) => void
  onStateChange?: (event: any) => void
  autoplay?: boolean
  className?: string
}

export default function YouTubePlayer({ 
  videoId, 
  onReady, 
  onStateChange, 
  autoplay = false,
  className = ''
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(100)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const hideControlsTimeout = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!containerRef.current) return

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initPlayer, 100)
        return
      }

      if (!videoId || videoId.trim() === '' || videoId.length !== 11) {
        console.error('Invalid video ID:', videoId)
        return
      }

      const playerId = `yt-player-${Math.random().toString(36).substr(2, 9)}`
      containerRef.current!.id = playerId

      try {
        playerRef.current = new window.YT.Player(playerId, {
          videoId,
          // Privacy-enhanced mode: weniger Tracking und bessere Kompatibilität
          // mit HTTP-Seiten und strengen Browser-Einstellungen.
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            disablekb: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (event: any) => {
              setDuration(event.target.getDuration())
              if (onReady) onReady(event.target)
            },
            onStateChange: (event: any) => {
              setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
              if (onStateChange) onStateChange(event)
            },
          },
        })
      } catch (error) {
        console.error('Error creating YouTube player:', error)
      }

      // Update progress
      const interval = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime())
        }
      }, 100)

      return () => clearInterval(interval)
    }

    initPlayer()

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy()
      }
    }
  }, [videoId, autoplay, onReady, onStateChange])

  const togglePlay = () => {
    if (!playerRef.current || !playerRef.current.playVideo) return
    if (isPlaying) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    if (!playerRef.current || !playerRef.current.setVolume) return
    playerRef.current.setVolume(newVolume)
    setVolume(newVolume)
  }

  const handleSeek = (time: number) => {
    if (!playerRef.current || !playerRef.current.seekTo) return
    playerRef.current.seekTo(time, true)
    setCurrentTime(time)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  return (
    <div 
      className={`relative bg-black ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* YouTube Player Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Custom Controls Overlay */}
      <div 
        className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="p-4 space-y-3">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-green-400"
            />
            <span className="text-xs text-white font-mono">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                {isPlaying ? (
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVolumeChange(volume > 0 ? 0 : 100)}
                  className="text-white hover:text-green-400 transition"
                >
                  {volume === 0 ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"/>
                    </svg>
                  ) : volume < 50 ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>

            {/* Right side controls (will be added by parent component) */}
            <div className="flex items-center gap-2">
              {/* Placeholder for additional controls */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
