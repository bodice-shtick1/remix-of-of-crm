import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages, type ConversationSummary } from '@/hooks/useMessages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle, X, Minus, Volume2, VolumeX, Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { ChannelIcon } from '@/components/icons/MessengerIcons';

export function FloatingInbox() {
  const navigate = useNavigate();
  const { conversations, isLoading, totalUnread, isMuted, toggleMute } = useMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleConversationClick = (conv: ConversationSummary) => {
    // Navigate to communication center with this client selected
    navigate(`/communication?client=${conv.client_id}`);
    setIsOpen(false);
  };

  const handleOpenFull = () => {
    navigate('/communication');
    setIsOpen(false);
  };

  // Minimized bar mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 no-print">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-t-lg shadow-lg hover:bg-primary/90 transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Центр связи</span>
          {totalUnread > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-[20px]">
              {totalUnread}
            </Badge>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 no-print">
      {/* Popup panel */}
      {isOpen && (
        <div className="mb-3 w-80 bg-popover border border-border rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">Центр связи</span>
              {totalUnread > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={toggleMute}
                title={isMuted ? 'Включить звук' : 'Выключить звук'}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={handleOpenFull}
                title="Открыть полностью"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setIsMinimized(true)}
                title="Свернуть в полоску"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Загрузка...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Нет диалогов
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.slice(0, 10).map(conv => (
                  <button
                    key={conv.client_id}
                    onClick={() => handleConversationClick(conv)}
                    className="w-full text-left p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="avatar-initials h-8 w-8 text-[10px] shrink-0">
                        {getClientInitials({ last_name: conv.client_last_name, first_name: conv.client_first_name })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground truncate">
                            {getClientDisplayName({ last_name: conv.client_last_name, first_name: conv.client_first_name })}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {format(new Date(conv.last_message_at), 'HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            <ChannelIcon channel={conv.last_channel} size={12} /> {conv.last_message}
                          </p>
                          {conv.unread_count > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-[16px] ml-1 shrink-0">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              className="w-full text-sm text-primary h-8"
              onClick={handleOpenFull}
            >
              Открыть Центр связи
            </Button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105',
          'bg-primary text-primary-foreground',
          isOpen && 'rotate-0'
        )}
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-6 min-w-[24px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold px-1.5 animate-pulse">
            {totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
