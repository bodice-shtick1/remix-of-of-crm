import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getNotificationSoundDataUri } from '@/lib/notificationSound';

const SOUND_ENABLED_KEY = 'email-sound-enabled';

export function useEmailSoundEnabled() {
  const get = (): boolean => {
    try {
      const v = localStorage.getItem(SOUND_ENABLED_KEY);
      return v === null ? true : v === 'true';
    } catch { return true; }
  };

  const set = (enabled: boolean) => {
    try { localStorage.setItem(SOUND_ENABLED_KEY, String(enabled)); } catch {}
  };

  return { get, set };
}

/** Play the embedded notification ding once. Useful for unlocking browser audio policy. */
export function playNotificationSound(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  try {
    if (!audioRef.current) {
      audioRef.current = new Audio(getNotificationSoundDataUri());
      audioRef.current.volume = 0.8;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      console.warn('[notification-sound] play() blocked:', err?.message || err);
    });
  } catch (err) {
    console.error('[notification-sound] Audio creation failed:', err);
  }
}

/**
 * Plays a notification sound when a new inbound email arrives via Realtime.
 * Must be mounted once globally (e.g. in App.tsx alongside EmailSyncInit).
 */
export function useEmailSoundNotification() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { get: isSoundEnabled } = useEmailSoundEnabled();

  const play = useCallback(() => {
    if (!isSoundEnabled()) return;
    playNotificationSound(audioRef);
  }, [isSoundEnabled]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email-sound-notification')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emails', filter: 'direction=eq.inbound' },
        () => { play(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, play]);
}
