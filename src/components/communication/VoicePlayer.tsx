import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface VoicePlayerProps {
  url: string;
  isMe?: boolean;
}

export function VoicePlayer({ url, isMe = false }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progressRef = useRef<HTMLDivElement>(null);

  const RATES = [1, 1.5, 2];

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying]);

  const cycleSpeed = useCallback(() => {
    const nextRate = RATES[(RATES.indexOf(playbackRate) + 1) % RATES.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }, [playbackRate]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !audio.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio * 100);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / (audio.duration || 1)) * 100);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  return (
    <div className={cn(
      'voice-player flex items-center gap-2 min-w-[220px] max-w-[280px] px-2 py-1.5',
      isMe ? 'voice-player-me' : 'voice-player-other'
    )}>
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play/Pause button */}
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          'h-8 w-8 shrink-0 rounded-full voice-player-btn',
          isMe
            ? 'text-primary-foreground hover:bg-primary-foreground/20'
            : 'text-foreground hover:bg-muted'
        )}
        onClick={togglePlay}
      >
        {isPlaying
          ? <Pause className="h-4 w-4" />
          : <Play className="h-4 w-4" />
        }
      </Button>

      {/* Waveform / progress bar */}
      <div className="flex-1 space-y-1">
        <div
          ref={progressRef}
          className="voice-player-track h-2 rounded-full overflow-hidden cursor-pointer relative"
          onClick={handleProgressClick}
        >
          <div
            className="voice-player-fill h-full rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
          {/* Static waveform dots for visual feel */}
          <div className="absolute inset-0 flex items-center gap-px px-0.5 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => {
              const h = [3, 5, 8, 6, 4, 9, 7, 5, 3, 6, 8, 4, 7, 5, 9, 6, 4, 8, 3, 7, 5, 6, 8, 4, 9, 5, 3, 7, 6, 4][i];
              return (
                <div
                  key={i}
                  className="voice-waveform-bar shrink-0 rounded-sm"
                  style={{ height: `${h}px`, width: '2px' }}
                />
              );
            })}
          </div>
        </div>

        {/* Time row */}
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-[10px] voice-player-time',
            isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <button
            onClick={cycleSpeed}
            className={cn(
              'text-[10px] font-mono font-semibold voice-player-speed transition-colors px-1 rounded',
              isMe
                ? 'text-primary-foreground/80 hover:text-primary-foreground'
                : 'text-primary hover:text-primary/80'
            )}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
