import { useState, useRef, useEffect, useCallback } from 'react'
import { C } from '../lib/constants'

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function VoiceMessagePlayer({ url, duration = 0, waveform, isMe = false }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadedDuration, setLoadedDuration] = useState(duration)
  const [speed, setSpeed] = useState(1)
  const audioRef = useRef(null)
  const rafRef = useRef(null)

  const SPEEDS = [1, 1.5, 2]

  const bars = waveform && waveform.length ? waveform : Array(32).fill(0.3)

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    audioRef.current?.pause()
  }, [])

  const tick = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const dur = audio.duration || loadedDuration || 1
    setCurrentTime(audio.currentTime)
    setProgress(Math.min(1, audio.currentTime / dur))
    if (!audio.paused && !audio.ended) rafRef.current = requestAnimationFrame(tick)
  }, [loadedDuration])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    } else {
      audio.playbackRate = speed
      audio.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [playing, tick, speed])

  const cycleSpeed = useCallback((e) => {
    e.stopPropagation()
    const idx = SPEEDS.indexOf(speed)
    const next = SPEEDS[(idx + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }, [speed])

  const handleEnded = () => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setLoadedDuration(audioRef.current.duration)
    }
    if (audioRef.current) audioRef.current.playbackRate = speed
  }

  const seekTo = (ratio) => {
    const audio = audioRef.current
    if (!audio) return
    const dur = audio.duration || loadedDuration || 1
    audio.currentTime = ratio * dur
    setProgress(ratio)
    setCurrentTime(audio.currentTime)
  }

  const activeBarIndex = Math.floor(progress * bars.length)
  const displayTime = playing || currentTime > 0 ? currentTime : loadedDuration

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <audio ref={audioRef} src={url} preload="metadata" onEnded={handleEnded} onLoadedMetadata={handleLoadedMetadata} />

      <button onClick={togglePlay}
        style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: isMe ? 'rgba(58,46,0,.25)' : 'linear-gradient(135deg,#f0c800,#c8a200)', color: '#3a2e00' }}>
        {playing ? '⏸' : '▶'}
      </button>

      <div
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect()
          seekTo(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, height: 24, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 2, borderRadius: 2, flexShrink: 0,
            height: Math.max(3, h * 20),
            background: i <= activeBarIndex ? (isMe ? '#3a2e00' : '#c8a200') : (isMe ? 'rgba(58,46,0,.35)' : C.borderMid)
          }} />
        ))}
      </div>

      <button onClick={cycleSpeed}
        style={{
          flexShrink: 0, minWidth: 30, height: 18, padding: '0 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
          fontSize: 10, fontWeight: 700, lineHeight: '18px', whiteSpace: 'nowrap',
          background: isMe ? 'rgba(58,46,0,.25)' : 'rgba(200,162,0,.18)',
          color: isMe ? '#3a2e00' : '#f0c800'
        }}>
        {speed}x
      </button>

      <span style={{ fontSize: 10, color: isMe ? '#3a2e00' : C.textDim, flexShrink: 0, minWidth: 26, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(displayTime)}
      </span>
    </div>
  )
}