import { useState, useRef, useCallback, useEffect } from 'react';

type RecordingState = 'idle' | 'recording' | 'uploading';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0); // seconds
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm, fall back to whatever browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(200); // collect every 200ms
      setState('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.error('Microphone error:', err);
      return false;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopTimer();
    stopStream();
    setState('idle');
    setElapsed(0);
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(null); return; }

      recorder.onstop = () => {
        const finalMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        chunksRef.current = [];
        stopStream();
        resolve(blob);
      };

      recorder.stop();
      stopTimer();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      mediaRecorderRef.current?.stop();
    };
  }, []);

  return {
    state,
    isRecording,
    isUploading,
    elapsed,
    formattedElapsed: formatElapsed(elapsed),
    startRecording,
    stopRecording,
    cancelRecording,
    setUploading: () => setState('uploading'),
    setIdle: () => setState('idle'),
  };
}
