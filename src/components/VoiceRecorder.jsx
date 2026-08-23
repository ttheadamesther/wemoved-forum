import { useState, useRef, useCallback, useEffect } from 'react'
import { C } from '../lib/constants'

const MAX_DURATION = 120
const BAR_COUNT = 32

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function downsampleWaveform(samples, targetCount) {
  if (samples.length === 0) return Array(targetCount).fill(0.1)
  if (samples.length <= targetCount) {
    const padded = [...samples]
    while (padded.length < targetCount) padded.push(samples[samples.length - 1] || 0.1)
    return padded.map(v => Math.max(0.05, Math.min(1, v)))
  }
  const blockSize = samples.length / targetCount
  const result = []
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * blockSize)
    const end = Math.floor((i + 1) * blockSize)
    const block = samples.slice(start, end)
    const max = block.length ? Math.max(...block) : 0.1
    result.push(Math.max(0.05, Math.min(1, max)))
  }
  return result
}

export default function VoiceRecorder({ onSend, onRecordingChange }) {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [liveBars, setLiveBars] = useState(Array(BAR_COUNT).fill(2))
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const barsBufferRef = useRef([])

  useEffect(() => { onRecordingChange?.(recording) }, [recording])

  useEffect(() => {
    if (document.getElementById('voice-rec-animations')) return
    const style = document.createElement('style')
    style.id = 'voice-rec-animations'
    style.textContent = `@keyframes voiceRecPulse { 0%,100%{opacity:1} 50%{opacity:.3} }`
    document.head.appendChild(style)
  }, [])

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close()
    mediaRecorderRef.current = null
    streamRef.current = null
    audioCtxRef.current = null
    analyserRef.current = null
    chunksRef.current = []
    barsBufferRef.current = []
  }, [])

  const tickWaveform = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    let peak = 0
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128
      if (v > peak) peak = v
    }
    barsBufferRef.current.push(peak)
    const recent = barsBufferRef.current.slice(-BAR_COUNT)
    const padded = Array(BAR_COUNT - recent.length).fill(2).concat(recent.map(v => Math.max(2, v * 22)))
    setLiveBars(padded)
    rafRef.current = requestAnimationFrame(tickWaveform)
  }, [])

  const stopRecording = useCallback((autoSend = false) => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const finalDuration = (Date.now() - startTimeRef.current) / 1000
      const waveform = downsampleWaveform(barsBufferRef.current, BAR_COUNT)
      cleanup()
      setRecording(false)
      setDuration(0)
      if (blob.size > 0) onSend(blob, Math.round(finalDuration), waveform, mimeType)
    }
    recorder.stop()
  }, [cleanup, onSend])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioCtx()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorderRef.current = recorder
      recorder.start()

      startTimeRef.current = Date.now()
      setDuration(0)
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setDuration(elapsed)
        if (elapsed >= MAX_DURATION) stopRecording(true)
      }, 200)

      setRecording(true)
      rafRef.current = requestAnimationFrame(tickWaveform)
    } catch (err) {
      setError('Micro inaccessible')
    }
  }, [stopRecording, tickWaveform])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    cleanup()
    setRecording(false)
    setDuration(0)
  }, [cleanup])

  if (error) {
    return <div style={{ fontSize: 11, color: C.red, padding: '0 8px', flexShrink: 0 }}>{error}</div>
  }

  if (!recording) {
    return (
      <button onClick={startRecording} title="Message vocal"
        style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${C.borderMid}`, background: C.surfaceB, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#c8a200'}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.borderMid}>
        🎤
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: C.surfaceB, border: `1px solid ${C.borderMid}`, borderRadius: 24, padding: '4px 6px 4px 10px' }}>
      <button onClick={cancelRecording} title="Annuler"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.red, flexShrink: 0, padding: 4, lineHeight: 1 }}>
        🗑️
      </button>

      <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, flexShrink: 0, animation: 'voiceRecPulse 1.1s ease-in-out infinite' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, height: 24, overflow: 'hidden', minWidth: 0 }}>
        {liveBars.map((h, i) => (
          <div key={i} style={{ width: 2, height: h, borderRadius: 2, background: '#c8a200', flexShrink: 0 }} />
        ))}
      </div>

      <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(duration)}
      </span>

      <button onClick={() => stopRecording(false)} title="Envoyer"
        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#f0c800,#c8a200)', color: '#3a2e00', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
        ➤
      </button>
    </div>
  )
}