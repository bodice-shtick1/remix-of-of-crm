import { useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';
import { useInternalChat } from '@/hooks/useInternalChat';

export function useUnreadCounts() {
  const { totalUnread: messengerUnread } = useMessages();
  const emailUnread = useUnreadEmailCount();
  const { rooms } = useInternalChat();

  const chatUnread = useMemo(() => {
    return rooms.reduce((sum, r) => sum + r.unreadCount, 0);
  }, [rooms]);

  return { messengerUnread, emailUnread, chatUnread };
}
