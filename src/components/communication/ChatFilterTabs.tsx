import { cn } from '@/lib/utils';
import { MessageSquare, Circle, User, Bot, MessageSquarePlus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

export type ChatFilter = 'all' | 'unread' | 'my' | 'autopilot';

interface ChatFilterTabsProps {
  value: ChatFilter;
  onChange: (filter: ChatFilter) => void;
  unreadCount: number;
  autopilotCount?: number;
  onNewChat?: () => void;
}

const FILTERS: { key: ChatFilter; label: string; Icon: typeof MessageSquare }[] = [
  { key: 'all', label: 'Все чаты', Icon: MessageSquare },
  { key: 'unread', label: 'Непрочитанные', Icon: Circle },
  { key: 'my', label: 'Мои диалоги', Icon: User },
  { key: 'autopilot', label: 'Автопилот', Icon: Bot },
];

export function ChatFilterTabs({ value, onChange, unreadCount, autopilotCount = 0, onNewChat }: ChatFilterTabsProps) {
  const getBadge = (key: ChatFilter) => {
    if (key === 'unread' && unreadCount > 0) return unreadCount;
    if (key === 'autopilot' && autopilotCount > 0) return autopilotCount;
    return 0;
  };

  return (
    <div className="space-y-0">
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center w-full bg-muted rounded-lg p-1 gap-0.5">
          {/* New chat button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onNewChat}
                className="relative flex-1 flex items-center justify-center h-9 min-w-[36px] rounded-md transition-colors text-primary hover:bg-accent font-semibold"
              >
                <MessageSquarePlus className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Новый чат
            </TooltipContent>
          </Tooltip>

          {/* Separator between new chat and filters */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Filter buttons */}
          {FILTERS.map(({ key, label, Icon }) => {
            const badge = getBadge(key);
            const isActive = value === key;

            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onChange(key)}
                    className={cn(
                      'relative flex-1 flex items-center justify-center h-9 min-w-[36px] rounded-md transition-colors',
                      isActive
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-3.5 min-w-[14px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
      <Separator className="mt-2" />
    </div>
  );
}
