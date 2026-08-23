import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

export default function VoiceMessagePlayer({ url, duration = 0, waveform, isOwn = false }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(duration);
  const audioRef = useRef(null);
  const rafRef = useRef(null);

  const bars = waveform && waveform.length ? waveform : Array(40).fill(0.3);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || loadedDuration || 1;
    setCurrentTime(audio.currentTime);
    setProgress(Math.min(1, audio.currentTime / dur));
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [loadedDuration]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      audio.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [playing, tick]);

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setLoadedDuration(audioRef.current.duration);
    }
  };

  const seekTo = (ratio) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || loadedDuration || 1;
    audio.currentTime = ratio * dur;
    setProgress(ratio);
    setCurrentTime(audio.currentTime);
  };

  const handleBarClick = (index) => {
    seekTo(index / (bars.length - 1));
  };

  const activeBarIndex = Math.floor(progress * bars.length);
  const displayTime = playing || currentTime > 0 ? currentTime : loadedDuration;

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <button
        type="button"
        onClick={togglePlay}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-purple-500 hover:bg-purple-400'
        } text-white`}
        aria-label={playing ? 'Pause' : 'Lecture'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <div
        className="flex items-center gap-[2px] flex-1 h-7 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
        }}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              handleBarClick(i);
            }}
            className={`w-[3px] rounded-full transition-colors shrink-0 ${
              i <= activeBarIndex ? (isOwn ? 'bg-white' : 'bg-purple-400') : isOwn ? 'bg-white/30' : 'bg-neutral-500'
            }`}
            style={{ height: `${Math.max(3, h * 24)}px` }}
          />
        ))}
      </div>

      <span className={`text-xs tabular-nums shrink-0 ${isOwn ? 'text-white/70' : 'text-neutral-400'}`}>
        {formatDuration(displayTime)}
      </span>
    </div>
  );
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}