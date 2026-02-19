import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useMessages, type ConversationSummary } from '@/hooks/useMessages';
import { useUnreadEmailCount } from '@/hooks/useUnreadEmailCount';
import { useInternalChat } from '@/hooks/useInternalChat';
import { useEmailAccounts } from '@/hooks/useEmailAccounts';
import { cn } from '@/lib/utils';
import {
  Mail, MessageCircle, MessagesSquare, X, Maximize2,
  Inbox, Send, Search, Users, EyeOff, Eye, Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CompactEmailList } from '@/components/email/CompactEmailList';
import { InternalChat } from '@/components/communication/InternalChat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ChannelIcon } from '@/components/icons/MessengerIcons';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';

type CommTab = 'messenger' | 'email' | 'chat';

interface PopupNotification {
  id: string;
  sender: string;
  snippet: string;
  tab: CommTab;
  timestamp: number;
}

const TAB_CONFIG: { key: CommTab; icon: typeof Mail; label: string; badgeColor: string }[] = [
  { key: 'email', icon: Mail, label: 'Почта', badgeColor: 'bg-blue-500' },
  { key: 'messenger', icon: MessageCircle, label: 'Мессенджеры', badgeColor: 'bg-emerald-500' },
  { key: 'chat', icon: MessagesSquare, label: 'Внутренний чат', badgeColor: 'bg-amber-500' },
];

export function FloatingCommPanel() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const { conversations, totalUnread: messengerUnread } = useMessages();
  const emailUnread = useUnreadEmailCount();
  const { rooms } = useInternalChat();
  const { accounts } = useEmailAccounts();

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<CommTab>('email');
  const [popups, setPopups] = useState<PopupNotification[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Email sub-dock state
  const [emailFolder, setEmailFolder] = useState<'inbox' | 'sent'>('inbox');
  const [emailAccountId, setEmailAccountId] = useState<string | undefined>();
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);

  // Messenger sub-dock state
  const [messengerSearch, setMessengerSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Chat sub-dock state
  const [chatSearch, setChatSearch] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const prevMessengerRef = useRef(messengerUnread);
  const prevEmailRef = useRef(emailUnread);
  const chatUnread = rooms.reduce((sum, r) => sum + r.unreadCount, 0);
  const prevChatRef = useRef(chatUnread);

  const counts: Record<CommTab, number> = {
    email: emailUnread,
    messenger: messengerUnread,
    chat: chatUnread,
  };

  const hasAnyUnread = emailUnread > 0 || messengerUnread > 0 || chatUnread > 0;

  const addPopup = useCallback((p: Omit<PopupNotification, 'id' | 'timestamp'>) => {
    const id = crypto.randomUUID();
    setPopups(prev => [...prev.slice(-2), { ...p, id, timestamp: Date.now() }]);
    setTimeout(() => setPopups(prev => prev.filter(n => n.id !== id)), 7000);
  }, []);

  useEffect(() => {
    if (messengerUnread > prevMessengerRef.current && conversations.length > 0) {
      const latest = conversations[0];
      if (latest) {
        addPopup({
          sender: getClientDisplayName({ last_name: latest.client_last_name, first_name: latest.client_first_name }),
          snippet: latest.last_message?.slice(0, 60) || 'Новое сообщение',
          tab: 'messenger',
        });
      }
    }
    prevMessengerRef.current = messengerUnread;
  }, [messengerUnread, conversations, addPopup]);

  useEffect(() => {
    if (emailUnread > prevEmailRef.current) {
      addPopup({ sender: 'Почта', snippet: 'Новое входящее письмо', tab: 'email' });
    }
    prevEmailRef.current = emailUnread;
  }, [emailUnread, addPopup]);

  useEffect(() => {
    if (chatUnread > prevChatRef.current) {
      const unreadRoom = rooms.find(r => r.unreadCount > 0);
      addPopup({
        sender: unreadRoom?.name || 'Чат',
        snippet: unreadRoom?.lastMessage?.text?.slice(0, 60) || 'Новое сообщение',
        tab: 'chat',
      });
    }
    prevChatRef.current = chatUnread;
  }, [chatUnread, rooms, addPopup]);

  // Auto-focus search inputs when switching tabs
  useEffect(() => {
    if (expanded && (activeTab === 'messenger' || activeTab === 'chat')) {
      setTimeout(() => searchInputRef.current?.focus(), 200);
    }
  }, [activeTab, expanded]);

  // Scroll detection for sub-dock dimming
  const handleContentScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 1500);
  }, []);

  if (!can('comm_floating_widget')) return null;

  const dismissPopup = (id: string) => setPopups(prev => prev.filter(n => n.id !== id));

  const switchTab = (tab: CommTab) => {
    if (tab === activeTab) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransitioning(false);
    }, 150);
  };

  const handleIconClick = (tab: CommTab) => {
    if (!expanded) {
      setActiveTab(tab);
      setExpanded(true);
    } else {
      switchTab(tab);
    }
  };

  const handleOpenFull = () => {
    const tabParam = activeTab === 'email' ? '?tab=email' : activeTab === 'chat' ? '?tab=chat' : '';
    navigate(`/communication${tabParam}`);
    setExpanded(false);
  };

  const popupBorderColor = (tab: CommTab) =>
    tab === 'messenger' ? 'border-l-emerald-500' : tab === 'email' ? 'border-l-blue-500' : 'border-l-amber-500';

  // Filter conversations for messenger view
  const filteredConversations = conversations.filter(conv => {
    if (unreadOnly && conv.unread_count === 0) return false;
    if (messengerSearch) {
      const name = getClientDisplayName({ last_name: conv.client_last_name, first_name: conv.client_first_name }).toLowerCase();
      if (!name.includes(messengerSearch.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <>
      {/* Floating comm tab — always visible when collapsed */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 no-print flex items-center justify-center w-10 h-16 rounded-l-2xl bg-primary/80 backdrop-blur-md border border-border/30 border-r-0 shadow-[-5px_0_15px_rgba(0,0,0,0.1)] hover:-translate-x-2 hover:w-12 transition-all duration-300 ease-out group"
          title="Открыть панель связи"
        >
          <MessageCircle className="h-5 w-5 text-primary-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-200" />

          {/* Pulsing red edge strip when there are unread events */}
          {hasAnyUnread && (
            <>
              <span className="absolute right-0 top-1 bottom-1 w-[3px] rounded-full bg-red-500 animate-pulse" />
              <span className="absolute right-0 top-1 bottom-1 w-[3px] rounded-full bg-red-500 animate-ping opacity-75" />
            </>
          )}
        </button>
      )}

      {/* Expanded panel — zero header */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 no-print h-full w-[400px] flex flex-col',
          'bg-card/80 dark:bg-card/85 backdrop-blur-2xl border-l border-border/40 shadow-2xl',
          'transition-transform duration-300 ease-out',
          expanded ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Content area — starts from Y=0, no header */}
        <div className="relative overflow-hidden" style={{ height: 'calc(100% - 90px)' }} onScroll={handleContentScroll}>
          {/* Floating controls — small, round, transparent until hover */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-background/80 backdrop-blur-sm transition-all duration-200"
                    onClick={handleOpenFull}
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">Открыть полностью</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-background/80 backdrop-blur-sm transition-all duration-200"
              onClick={() => setExpanded(false)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div
            className={cn(
              'h-full transition-opacity duration-150 ease-in-out',
              transitioning ? 'opacity-0' : 'opacity-100'
            )}
          >
            {activeTab === 'messenger' && (
              <MessengerMiniView conversations={filteredConversations} />
            )}
            {activeTab === 'email' && (
              <div className="h-full">
                <CompactEmailList
                  folder={emailFolder}
                  accountId={emailAccountId}
                  composerOpen={emailComposerOpen}
                  onComposerOpenChange={setEmailComposerOpen}
                />
              </div>
            )}
            {activeTab === 'chat' && (
              <div className="h-full">
                <InternalChat compact externalSearch={chatSearch} />
              </div>
            )}
          </div>
        </div>

        {/* Bottom section: Sub-dock + Main tabs */}
        <div
          className={cn(
            'shrink-0 border-t border-border/30 backdrop-blur-md bg-background/70 dark:bg-background/60 transition-opacity duration-500',
            isScrolling ? 'opacity-60' : 'opacity-100'
          )}
        >
          {/* Contextual sub-dock */}
          <ContextualSubDock
            activeTab={activeTab}
            emailFolder={emailFolder}
            onEmailFolderChange={setEmailFolder}
            accounts={accounts}
            emailAccountId={emailAccountId}
            onEmailAccountChange={setEmailAccountId}
            onCompose={() => setEmailComposerOpen(true)}
            messengerSearch={messengerSearch}
            onMessengerSearchChange={setMessengerSearch}
            unreadOnly={unreadOnly}
            onUnreadOnlyChange={setUnreadOnly}
            chatSearch={chatSearch}
            onChatSearchChange={setChatSearch}
            searchInputRef={searchInputRef}
          />

          {/* Main tab icons */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center justify-around py-1.5 px-2">
              {TAB_CONFIG.map(t => {
                const count = counts[t.key];
                return (
                  <Tooltip key={t.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleIconClick(t.key)}
                        className={cn(
                          'relative flex items-center justify-center p-2.5 rounded-xl transition-all duration-200',
                          activeTab === t.key
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <t.icon className="h-5 w-5" />
                        {count > 0 && (
                          <span className={cn(
                            'absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 leading-none',
                            t.badgeColor
                          )}>
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">{t.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Backdrop overlay when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-foreground/5 backdrop-blur-[1px] transition-opacity duration-300 no-print"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Popup notifications — Portal to document.body, always on top */}
      {popups.length > 0 && createPortal(
        <div className="fixed right-[12px] bottom-[100px] z-[9999] flex flex-col gap-1.5 w-[380px] pointer-events-none no-print">
          {popups.map(p => (
            <div
              key={p.id}
              className={cn(
                'pointer-events-auto relative bg-popover/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-lg p-2.5 cursor-pointer border-l-4 animate-fade-in',
                popupBorderColor(p.tab)
              )}
              onClick={() => { handleIconClick(p.tab); dismissPopup(p.id); }}
            >
              <button
                className="absolute top-1 right-1 p-0.5 rounded-full hover:bg-muted/60 transition-colors"
                onClick={(e) => { e.stopPropagation(); dismissPopup(p.id); }}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
              <p className="text-xs font-semibold text-foreground truncate pr-4">{p.sender}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.snippet}</p>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

/* ─── Contextual Sub-Dock ──────────────────────────────────────────── */

interface SubDockProps {
  activeTab: CommTab;
  emailFolder: 'inbox' | 'sent';
  onEmailFolderChange: (f: 'inbox' | 'sent') => void;
  accounts: { id: string; display_name: string | null; email_address: string }[];
  emailAccountId: string | undefined;
  onEmailAccountChange: (id: string | undefined) => void;
  onCompose: () => void;
  messengerSearch: string;
  onMessengerSearchChange: (v: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
  chatSearch: string;
  onChatSearchChange: (v: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

function ContextualSubDock({
  activeTab,
  emailFolder,
  onEmailFolderChange,
  accounts,
  emailAccountId,
  onEmailAccountChange,
  onCompose,
  messengerSearch,
  onMessengerSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  chatSearch,
  onChatSearchChange,
  searchInputRef,
}: SubDockProps) {
  return (
    <div className="px-2 py-1.5 border-b border-border/20 flex items-center gap-1.5 min-h-[36px]">
      {activeTab === 'email' && (
        <EmailSubDock
          folder={emailFolder}
          onFolderChange={onEmailFolderChange}
          accounts={accounts}
          accountId={emailAccountId}
          onAccountChange={onEmailAccountChange}
          onCompose={onCompose}
        />
      )}
      {activeTab === 'messenger' && (
        <MessengerSubDock
          search={messengerSearch}
          onSearchChange={onMessengerSearchChange}
          unreadOnly={unreadOnly}
          onUnreadOnlyChange={onUnreadOnlyChange}
          searchInputRef={searchInputRef}
        />
      )}
      {activeTab === 'chat' && (
        <ChatSubDock
          search={chatSearch}
          onSearchChange={onChatSearchChange}
          searchInputRef={searchInputRef}
        />
      )}
    </div>
  );
}

/* ─── Email Sub-Dock ───────────────────────────────────────────────── */

function EmailSubDock({
  folder,
  onFolderChange,
  accounts,
  accountId,
  onAccountChange,
  onCompose,
}: {
  folder: 'inbox' | 'sent';
  onFolderChange: (f: 'inbox' | 'sent') => void;
  accounts: { id: string; display_name: string | null; email_address: string }[];
  accountId: string | undefined;
  onAccountChange: (id: string | undefined) => void;
  onCompose: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onFolderChange('inbox')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                folder === 'inbox' ? 'bg-blue-500/15 text-blue-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Inbox className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Входящие</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onFolderChange('sent')}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                folder === 'sent' ? 'bg-blue-500/15 text-blue-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Отправленные</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {accounts.length > 1 && (
          <select
            value={accountId ?? ''}
            onChange={e => onAccountChange(e.target.value || undefined)}
            className="text-[11px] h-7 rounded-md border border-border/50 bg-transparent text-muted-foreground px-1.5 max-w-[120px] truncate focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Все</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.display_name || a.email_address}</option>
            ))}
          </select>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCompose}
              className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Написать</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ─── Messenger Sub-Dock ───────────────────────────────────────────── */

function MessengerSubDock({
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  searchInputRef,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Поиск клиента..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full h-7 rounded-md border border-border/50 bg-transparent pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onUnreadOnlyChange(!unreadOnly)}
              className={cn(
                'p-1.5 rounded-lg transition-colors shrink-0',
                unreadOnly ? 'bg-emerald-500/15 text-emerald-500' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {unreadOnly ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {unreadOnly ? 'Показать все' : 'Только непрочитанные'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ─── Chat Sub-Dock ────────────────────────────────────────────────── */

function ChatSubDock({
  search,
  onSearchChange,
  searchInputRef,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Поиск коллег..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full h-7 rounded-md border border-border/50 bg-transparent pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {search && (
            <button onClick={() => onSearchChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0">
              <Users className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Новая группа</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ─── Messenger Mini View ──────────────────────────────────────────── */

function MessengerMiniView({ conversations }: { conversations: ConversationSummary[] }) {
  const navigate = useNavigate();

  if (conversations.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Нет диалогов</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border/30">
        {conversations.slice(0, 25).map(conv => (
          <button
            key={conv.client_id}
            onClick={() => navigate(`/communication?client=${conv.client_id}`)}
            className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
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
                    <Badge className="bg-emerald-500 text-white text-[10px] h-4 min-w-[16px] ml-1 shrink-0 border-0">
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
