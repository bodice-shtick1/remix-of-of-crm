import { type Message } from '@/hooks/useMessages';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ChatMediaRenderer } from '@/components/communication/ChatMediaRenderer';
import {
  Clock, Check, CheckCheck, AlertCircle, RotateCw, Trash2,
  Lock, StickyNote, Bot,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { ChannelIcon } from '@/components/icons/MessengerIcons';

function DeliveryStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3 animate-pulse" />;
    case 'sent':
      return <Check className="h-3 w-3" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-sky-400" />;
    case 'error':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Check className="h-3 w-3" />;
  }
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onResend?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
}

export function MessageBubble({ message, isOwn, onResend, onDelete }: MessageBubbleProps) {
  const isInternal = message.is_internal;
  const isIncoming = message.direction === 'in';
  const isAutomated = !!message.is_automated;
  const hasMedia = message.message_type !== 'text' && message.media_url;
  const isOptimistic = message._optimistic;
  const deliveryStatus = message.delivery_status || 'sent';
  const isError = deliveryStatus === 'error';

  // Internal notes — full-width centered style
  if (isInternal) {
    return (
      <div className="flex justify-center px-4 overflow-hidden">
        <div className="w-full max-w-[85%] rounded-lg px-3 py-2 border border-dashed border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700/40 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="h-3 w-3 text-amber-500/70 shrink-0" />
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Заметка</span>
          </div>
          <p className="text-sm italic text-amber-900/80 dark:text-amber-200/80" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {message.content}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-amber-500/60">
            <ChannelIcon channel={message.channel} size={12} />
            <span className="text-[10px]">{format(new Date(message.created_at), 'HH:mm')}</span>
          </div>
        </div>
      </div>
    );
  }

  // Automated (autopilot) messages — system-style centered
  if (isAutomated) {
    return (
      <div className="flex justify-center px-4 overflow-hidden">
        <div className="w-full max-w-[85%] rounded-lg px-3 py-2 border border-dashed border-muted-foreground/20 bg-muted/30 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground">Автопилот</span>
          </div>
          <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {message.content}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground/50">
            <ChannelIcon channel={message.channel} size={12} />
            <span className="text-[10px]">{format(new Date(message.created_at), 'HH:mm')}</span>
            <DeliveryStatusIcon status={deliveryStatus} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex overflow-hidden', isIncoming ? 'justify-start' : 'justify-end')}>
      <div className="flex items-end gap-1.5 max-w-[80%] md:max-w-[70%] min-w-0">
        {/* Error action button — left of the bubble for outgoing */}
        {!isIncoming && isError && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="mb-1 p-1 rounded-full bg-destructive/20 hover:bg-destructive/30 transition-colors"
                title="Ошибка отправки"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="left" className="w-auto p-1" align="end">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onResend?.(message)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-muted transition-colors text-foreground"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Повторить отправку
                </button>
                <button
                  onClick={() => onDelete?.(message)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded hover:bg-destructive/10 transition-colors text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div
          className={cn(
            'rounded-xl px-3 py-2 text-sm min-w-0 overflow-hidden',
            isIncoming
              ? 'bg-muted text-foreground'
              : isError
                ? 'bg-destructive/80 text-destructive-foreground'
                : isOptimistic
                  ? 'bg-primary/70 text-primary-foreground'
                  : 'bg-primary text-primary-foreground'
          )}
        >
          {hasMedia && (
            <div className="mb-1.5">
              <ChatMediaRenderer
                messageType={message.message_type}
                mediaUrl={message.media_url}
                mediaType={message.media_type}
                content={message.content}
              />
            </div>
          )}

          {(message.message_type === 'text' || (message.content && !message.content.match(/^[📷🎤🎵🎬📄🖼️]/))) && (
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</p>
          )}

          {isError && message._error && (
            <p className="text-[10px] mt-1 opacity-80">⚠ {message._error}</p>
          )}

          <div className={cn(
            'flex items-center gap-1.5 mt-1',
            isIncoming ? 'text-muted-foreground' : 'text-primary-foreground/70'
          )}>
            <ChannelIcon channel={message.channel} size={12} />
            <span className="text-[10px]">{format(new Date(message.created_at), 'HH:mm')}</span>
            {!isIncoming && (
              <DeliveryStatusIcon status={deliveryStatus} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
