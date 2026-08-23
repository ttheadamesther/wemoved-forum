import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Trash2, Send } from 'lucide-react';

const MAX_DURATION = 120; // 2 min
const BAR_COUNT = 40;

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export default function VoiceRecorder({ onSend, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [liveBars, setLiveBars] = useState(Array(BAR_COUNT).fill(2));
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const barsBufferRef = useRef([]);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    barsBufferRef.current = [];
  }, []);

  const tickWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    barsBufferRef.current.push(peak);
    const recent = barsBufferRef.current.slice(-BAR_COUNT);
    const padded = Array(BAR_COUNT - recent.length).fill(2).concat(recent.map((v) => Math.max(2, v * 32)));
    setLiveBars(padded);
    rafRef.current = requestAnimationFrame(tickWaveform);
  }, []);

  const stopRecording = useCallback(
    (autoSend = false) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') return;

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const finalDuration = (Date.now() - startTimeRef.current) / 1000;
        const waveform = downsampleWaveform(barsBufferRef.current, BAR_COUNT);
        cleanup();
        setRecording(false);
        setDuration(0);
        if (blob.size > 0) {
          onSend(blob, Math.round(finalDuration), waveform, mimeType);
        }
      };
      recorder.stop();
    },
    [cleanup, onSend]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();

      startTimeRef.current = Date.now();
      setDuration(0);
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);
        if (elapsed >= MAX_DURATION) stopRecording(true);
      }, 200);

      setRecording(true);
      rafRef.current = requestAnimationFrame(tickWaveform);
    } catch (err) {
      setError('Micro inaccessible. Vérifie les permissions.');
    }
  }, [stopRecording, tickWaveform]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setRecording(false);
    setDuration(0);
    onCancel?.();
  }, [cleanup, onCancel]);

  if (error) {
    return <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-400">{error}</div>;
  }

  if (!recording) {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        aria-label="Enregistrer un message vocal"
      >
        <Mic size={20} />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800 rounded-full flex-1"
    >
      <button
        type="button"
        onClick={cancelRecording}
        className="p-1.5 rounded-full text-neutral-400 hover:text-red-400 transition-colors shrink-0"
        aria-label="Annuler"
      >
        <Trash2 size={16} />
      </button>

      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />

      <div className="flex items-center gap-[2px] flex-1 h-6 overflow-hidden">
        {liveBars.map((h, i) => (
          <div key={i} className="w-[2px] bg-purple-400 rounded-full shrink-0" style={{ height: `${h}px` }} />
        ))}
      </div>

      <span className="text-xs text-neutral-400 tabular-nums shrink-0">{formatDuration(duration)}</span>

      <button
        type="button"
        onClick={() => stopRecording(false)}
        className="p-1.5 rounded-full bg-purple-500 hover:bg-purple-400 text-white transition-colors shrink-0"
        aria-label="Envoyer"
      >
        <Send size={14} />
      </button>
    </motion.div>
  );
}

function downsampleWaveform(samples, targetCount) {
  if (samples.length === 0) return Array(targetCount).fill(0.1);
  if (samples.length <= targetCount) {
    const padded = [...samples];
    while (padded.length < targetCount) padded.push(samples[samples.length - 1] || 0.1);
    return padded.map((v) => Math.max(0.05, Math.min(1, v)));
  }
  const blockSize = samples.length / targetCount;
  const result = [];
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * blockSize);
    const end = Math.floor((i + 1) * blockSize);
    const block = samples.slice(start, end);
    const max = block.length ? Math.max(...block) : 0.1;
    result.push(Math.max(0.05, Math.min(1, max)));
  }
  return result;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}