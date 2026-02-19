import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Download, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMediaRendererProps {
  messageType: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  content: string;
}

export function ChatMediaRenderer({ messageType, mediaUrl, mediaType, content }: ChatMediaRendererProps) {
  if (messageType === 'text' || !mediaUrl) {
    return null;
  }

  if (messageType === 'photo' || mediaType === 'photo') {
    return <PhotoMessage url={mediaUrl} />;
  }

  if (messageType === 'voice' || messageType === 'audio' || mediaType === 'voice') {
    return <AudioMessage url={mediaUrl} isVoice={messageType === 'voice'} />;
  }

  if (messageType === 'video' || mediaType === 'video') {
    return (
      <video
        src={mediaUrl}
        controls
        className="max-w-full rounded-lg max-h-64"
        preload="metadata"
      />
    );
  }

  if (messageType === 'sticker' || mediaType === 'sticker') {
    return (
      <img
        src={mediaUrl}
        alt="Стикер"
        className="max-w-[180px] max-h-[180px]"
        loading="lazy"
      />
    );
  }

  // Document/file fallback
  return <DocumentMessage url={mediaUrl} content={content} />;
}

function PhotoMessage({ url }: { url: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <img
        src={url}
        alt="Фото"
        className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
        loading="lazy"
        onClick={() => setIsExpanded(true)}
      />
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          <img
            src={url}
            alt="Фото"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}

function AudioMessage({ url, isVoice }: { url: string; isVoice: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
          }
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex-1 space-y-1">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(duration)}
          </span>
          {isVoice && (
            <button
              onClick={cycleSpeed}
              className="text-[10px] font-mono font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {playbackRate}x
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentMessage({ url, content }: { url: string; content: string }) {
  const fileName = content.replace('📄 ', '') || 'Документ';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
    >
      <FileText className="h-8 w-8 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{fileName}</p>
        <p className="text-[10px] text-muted-foreground">Нажмите для скачивания</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  );
}
