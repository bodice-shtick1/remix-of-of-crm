import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PresenceContextValue {
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) {
      setOnlineUsers(new Set());
      return;
    }

    const channel = supabase.channel('global-presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const online = new Set<string>();
        for (const key of Object.keys(state)) {
          const entries = state[key] as any[];
          if (entries?.[0]?.user_id) {
            online.add(String(entries[0].user_id));
          } else {
            online.add(String(key));
          }
        }
        console.log('[Presence] sync, online users:', [...online]);
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const userId = (newPresences as any)?.[0]?.user_id ? String((newPresences as any)[0].user_id) : String(key);
        console.log('[Presence] join:', userId);
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.add(userId);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const userId = (leftPresences as any)?.[0]?.user_id ? String((leftPresences as any)[0].user_id) : String(key);
        console.log('[Presence] leave:', userId);
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          } catch (err) {
            console.error('[Presence] track failed:', err);
          }
        }
      });

    channelRef.current = channel;

    // Fallback: update DB last_seen periodically
    const updateLastSeen = () => supabase.rpc('update_last_seen');
    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.has(String(userId));
  }, [onlineUsers]);

  return (
    <PresenceContext.Provider value={{ onlineUsers, isUserOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}
