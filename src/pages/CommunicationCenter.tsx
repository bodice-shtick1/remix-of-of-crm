import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessages, type ConversationSummary, type MessageChannel, type Message } from '@/hooks/useMessages';
import { ArchiveChatDialog } from '@/components/communication/ArchiveChatDialog';
import { useAuth } from '@/hooks/useAuth';
import { useTelegramSync } from '@/hooks/useTelegramSync';
import { useMessagePolling } from '@/hooks/useMessagePolling';
import { usePinnedChats } from '@/hooks/usePinnedChats';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Send, StickyNote, MessageCircle, User,
  Volume2, VolumeX, ArrowRightLeft, Hash, Plus,
  RefreshCw, Loader2, Download, X, Pin, PinOff,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewChatDialog } from '@/components/communication/NewChatDialog';
import { NewClientBanner } from '@/components/communication/NewClientBanner';
import { ChatMediaAttachment } from '@/components/communication/ChatMediaAttachment';
import { MessageBubble } from '@/components/communication/MessageBubble';
import { SessionExpiredBanner } from '@/components/communication/SessionExpiredBanner';
import { ChatFilterTabs, type ChatFilter } from '@/components/communication/ChatFilterTabs';
import { ScrollToBottomButton } from '@/components/communication/ScrollToBottomButton';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { ChannelIcon } from '@/components/icons/MessengerIcons';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';
import { EmailInbox } from '@/components/email/EmailInbox';
import { InternalChat } from '@/components/communication/InternalChat';
import { Mail, MessageSquare } from 'lucide-react';

type CommView = 'messenger' | 'email' | 'chat';

export default function CommunicationCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [commView, setCommView] = useState<CommView>(() => {
    return searchParams.get('tab') === 'email' ? 'email' : 'messenger';
  });
  const [initialEmailId, setInitialEmailId] = useState(() => searchParams.get('id') || undefined);

  // Force tab switch before paint (handles navigation & Keep-Alive re-activation)
  useLayoutEffect(() => {
    const tab = searchParams.get('tab');
    const id = searchParams.get('id');
    if (tab === 'email') {
      setCommView('email');
      if (id) setInitialEmailId(id);
    }
  }, [searchParams]);

  // Clear URL params after consuming them
  useEffect(() => {
    if (searchParams.has('tab') || searchParams.has('id')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const { user, userRole } = useAuth();
  const {
    conversations, isLoading, totalUnread,
    useClientMessages, sendMessage, isSending,
    markAsRead, isMuted, toggleMute,
  } = useMessages();
  const { isConfigured: tgConfigured, isSyncing, backfillChat, pollMessages, telegramConfig, onlineStatuses } = useTelegramSync();
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  useMessagePolling(selectedClientId);
  const [search, setSearch] = useState('');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newClientIds, setNewClientIds] = useState<Set<string>>(new Set());
  const [pendingMedia, setPendingMedia] = useState<{ mediaUrl: string; mediaType: string; fileName: string } | null>(null);
  const [isSendingTg, setIsSendingTg] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pendingRetryMsg, setPendingRetryMsg] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const prevMsgCountRef = useRef(0);

  const { isPinned, togglePin, pinnedIds } = usePinnedChats();
  const { matchedClientIds, snippetMap, isActive: isSearchInMessages } = useMessageSearch(search);

  const clientMessagesResult = useClientMessages(selectedClientId);
  const messages = clientMessagesResult.data ?? [];

  // Archived client IDs
  const { data: archivedClients } = useQuery({
    queryKey: ['archived-clients'],
    queryFn: async () => {
      const { data } = await (supabase
        .from('clients')
        .select('id, is_archived, archive_reason')
        .eq('is_archived', true) as any);
      return new Map((data || []).map((c: any) => [c.id, c.archive_reason]));
    },
    enabled: !!user,
    staleTime: 15_000,
  });

  // Templates for quick replies
  const { data: templates } = useQuery({
    queryKey: ['notification-templates-quick'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Selected conversation
  const selectedConv = conversations.find(c => c.client_id === selectedClientId);

  // Filter conversations by tab + search
  const filtered = useMemo(() => {
    let result = conversations;

    // Filter by archive status
    if (chatFilter === 'autopilot') {
      // Show non-archived chats where last message is automated
      result = result.filter(c => !archivedClients?.has(c.client_id) && c.last_is_automated);
    } else {
      // Non-archived tabs: hide archived chats
      result = result.filter(c => !archivedClients?.has(c.client_id));

      // Tab filter
      if (chatFilter === 'unread') {
        result = result.filter(c => c.unread_count > 0);
      } else if (chatFilter === 'my') {
        result = result.filter(c => c.manager_id === user?.id);
      }
    }

    // Text search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        `${c.client_last_name} ${c.client_first_name}`.toLowerCase().includes(s) ||
        c.client_phone.includes(s) ||
        (isSearchInMessages && matchedClientIds.has(c.client_id))
      );
    }

    // Sort: pinned first, then by last_message_at
    return result.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.client_id) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.client_id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [conversations, search, chatFilter, user?.id, isSearchInMessages, matchedClientIds, pinnedIds, archivedClients]);

  // Smart auto-scroll
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollAreaRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    setIsScrolledUp(false);
    setNewMsgCount(0);
  }, []);

  // Scroll on chat open
  useEffect(() => {
    if (selectedClientId) {
      // Reset scroll state on chat change
      setIsScrolledUp(false);
      setNewMsgCount(0);
      prevMsgCountRef.current = 0;
      setTimeout(() => scrollToBottom('instant'), 50);
    }
  }, [selectedClientId, scrollToBottom]);

  // Scroll on new messages (only if user is at bottom)
  useEffect(() => {
    if (!messages.length) return;
    if (messages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      // New message arrived
      if (isScrolledUp) {
        setNewMsgCount(prev => prev + (messages.length - prevMsgCountRef.current));
      } else {
        scrollToBottom();
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isScrolledUp, scrollToBottom]);

  // Detect scroll position
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsScrolledUp(!isAtBottom);
    if (isAtBottom) {
      setNewMsgCount(0);
    }
  }, []);

  // Mark as read when selecting
  useEffect(() => {
    if (selectedClientId) {
      markAsRead(selectedClientId);
    }
  }, [selectedClientId, markAsRead]);

  // Handle input for / commands
  const handleInputChange = (val: string) => {
    setInputValue(val);
    setShowTemplates(val.startsWith('/'));
  };

  // Auto-retry queue for FLOOD_WAIT
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Schedule auto-retry for FLOOD_WAIT
  const scheduleFloodRetry = useCallback((optimisticId: string, clientId: string, seconds: number, sendBody: any) => {
    // Mark the optimistic message as "queued"
    queryClient.setQueryData<Message[]>(['messages', clientId], (old) =>
      (old || []).map(m => m.id === optimisticId
        ? { ...m, delivery_status: 'pending' as const, _error: `В очереди (${seconds} сек)` }
        : m
      )
    );

    toast.info(`Telegram просит подождать ${seconds} сек. Сообщение будет отправлено автоматически.`, { duration: seconds * 1000 });

    retryTimerRef.current = setTimeout(async () => {
      // Update status
      queryClient.setQueryData<Message[]>(['messages', clientId], (old) =>
        (old || []).map(m => m.id === optimisticId
          ? { ...m, _error: undefined, delivery_status: 'pending' as const }
          : m
        )
      );

      try {
        const { data, error } = await supabase.functions.invoke('send-telegram-message', { body: sendBody });
        if (error && !data) throw error;
        if (!data?.success) {
          queryClient.setQueryData<Message[]>(['messages', clientId], (old) =>
            (old || []).map(m => m.id === optimisticId
              ? { ...m, delivery_status: 'error' as const, _error: data?.error || 'Ошибка' }
              : m
            )
          );
          toast.error(data?.error || 'Повторная отправка не удалась');
          return;
        }

        // Success — save to DB
        await (supabase.from('messages' as any).insert([{
          client_id: clientId,
          user_id: user!.id,
          manager_id: user!.id,
          content: sendBody.message || '',
          direction: 'out',
          channel: 'telegram',
          is_internal: false,
          is_read: true,
          message_type: sendBody.media_type || 'text',
          media_url: sendBody.media_url || null,
          media_type: sendBody.media_type || null,
          external_message_id: data.message_id ? `tg_${data.message_id}` : null,
          delivery_status: 'sent',
        }]) as any);

        // Remove optimistic
        queryClient.setQueryData<Message[]>(['messages', clientId], (old) =>
          (old || []).filter(m => m.id !== optimisticId)
        );
        queryClient.invalidateQueries({ queryKey: ['messages', clientId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        toast.success('Сообщение отправлено');
      } catch (err: any) {
        queryClient.setQueryData<Message[]>(['messages', clientId], (old) =>
          (old || []).map(m => m.id === optimisticId
            ? { ...m, delivery_status: 'error' as const, _error: err?.message || 'Ошибка' }
            : m
          )
        );
        toast.error(`Повторная отправка не удалась: ${err?.message}`);
      }
    }, seconds * 1000);
  }, [queryClient, user]);

  // Telegram error classifier
  const showTelegramError = useCallback((data: any, failedMsg?: Message, optimisticId?: string, clientId?: string, sendBody?: any) => {
    const errMsg = data?.error || 'Ошибка отправки';
    if (data?.session_expired) {
      setSessionExpired(true);
      if (failedMsg) setPendingRetryMsg(failedMsg);
      toast.error('Сессия Telegram истекла', { duration: 4000 });
    } else if (data?.error_code === 'FLOOD_WAIT' && data?.flood_wait_seconds && optimisticId && clientId && sendBody) {
      // Auto-retry after wait
      scheduleFloodRetry(optimisticId, clientId, data.flood_wait_seconds, sendBody);
    } else if (data?.error_code === 'FLOOD_WAIT') {
      toast.error(errMsg);
    } else if (data?.error_code === 'PEER_INVALID') {
      toast.error('Клиент ограничил приём сообщений');
    } else {
      toast.error(`Ошибка отправки: ${errMsg}`);
    }
  }, [scheduleFloodRetry]);

  const handleSend = useCallback(async () => {
    if (!selectedClientId || !selectedConv || !user) return;
    const channel = selectedConv.last_channel || 'whatsapp';

    // Internal notes — save directly to DB, never call messaging API
    if (isNoteMode) {
      if (!inputValue.trim()) return;
      sendMessage({
        client_id: selectedClientId,
        content: inputValue.trim(),
        channel,
        is_internal: true,
      });
      setInputValue('');
      setIsNoteMode(false);
      return;
    }

    // All Telegram outgoing messages go through MTProto edge function
    if (channel === 'telegram' && tgConfigured && telegramConfig) {
      const hasMedia = !!pendingMedia;
      const hasText = !!inputValue.trim();
      if (!hasMedia && !hasText) return;

      const optimisticId = `optimistic_${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        client_id: selectedClientId,
        user_id: user.id,
        manager_id: user.id,
        content: inputValue.trim() || (hasMedia ? `[${pendingMedia!.mediaType}]` : ''),
        direction: 'out',
        channel: 'telegram',
        is_internal: false,
        is_read: true,
        is_automated: false,
        template_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        external_message_id: null,
        media_url: hasMedia ? pendingMedia!.mediaUrl : null,
        media_type: hasMedia ? pendingMedia!.mediaType : null,
        message_type: hasMedia ? pendingMedia!.mediaType : 'text',
        delivery_status: 'pending',
        _optimistic: true,
      };

      // Optimistic insert into cache
      queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) => [
        ...(old || []),
        optimisticMsg,
      ]);

      const savedInput = inputValue.trim();
      const savedMedia = pendingMedia;
      setInputValue('');
      setPendingMedia(null);

      try {
        const cleanPhone = selectedConv.client_phone.replace(/\D/g, '');
        const sendBody = {
          ...telegramConfig,
          phone: cleanPhone,
          message: savedInput,
          client_id: selectedClientId,
          ...(savedMedia ? {
            media_url: savedMedia.mediaUrl,
            media_type: savedMedia.mediaType,
            file_name: savedMedia.fileName,
          } : {}),
        };
        const { data, error } = await supabase.functions.invoke('send-telegram-message', {
          body: sendBody,
        });

        // Edge function now always returns 200, check success in body
        if (error && !data) throw error;
        if (!data?.success) {
          const errMsg = data?.error || 'Ошибка отправки';
          // For FLOOD_WAIT, don't mark as error — schedule retry
          if (data?.error_code === 'FLOOD_WAIT' && data?.flood_wait_seconds) {
            showTelegramError(data, undefined, optimisticId, selectedClientId, sendBody);
          } else {
            queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
              (old || []).map(m => m.id === optimisticId
                ? { ...m, delivery_status: 'error' as const, _error: errMsg }
                : m
              )
            );
            showTelegramError(data);
          }
          return;
        }

        // Save to DB
        await (supabase.from('messages' as any).insert([{
          client_id: selectedClientId,
          user_id: user.id,
          manager_id: user.id,
          content: savedInput || (savedMedia ? `[${savedMedia.mediaType}]` : ''),
          direction: 'out',
          channel: 'telegram',
          is_internal: false,
          is_read: true,
          message_type: savedMedia ? savedMedia.mediaType : 'text',
          media_url: savedMedia?.mediaUrl || null,
          media_type: savedMedia?.mediaType || null,
          external_message_id: data.message_id ? `tg_${data.message_id}` : null,
          delivery_status: 'sent',
        }]) as any);

        // Remove optimistic, let realtime/invalidation bring the real one
        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
          (old || []).filter(m => m.id !== optimisticId)
        );
        queryClient.invalidateQueries({ queryKey: ['messages', selectedClientId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } catch (err: any) {
        console.error('TG send error:', err);
        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
          (old || []).map(m => m.id === optimisticId
            ? { ...m, delivery_status: 'error' as const, _error: err?.message || 'Ошибка' }
            : m
          )
        );
        toast.error(`Ошибка отправки: ${err?.message || 'Неизвестная ошибка'}`);
      }
      return;
    }

    // MAX channel — send via send-max-message edge function
    if (channel === 'max') {
      const hasMedia = !!pendingMedia;
      const hasText = !!inputValue.trim();
      if (!hasMedia && !hasText) return;

      const optimisticId = `optimistic_${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId, client_id: selectedClientId, user_id: user.id, manager_id: user.id,
        content: inputValue.trim() || (hasMedia ? `[${pendingMedia!.mediaType}]` : ''),
        direction: 'out', channel: 'max', is_internal: false, is_read: true, is_automated: false,
        template_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        external_message_id: null, media_url: hasMedia ? pendingMedia!.mediaUrl : null,
        media_type: hasMedia ? pendingMedia!.mediaType : null,
        message_type: hasMedia ? pendingMedia!.mediaType : 'text',
        delivery_status: 'pending', _optimistic: true,
      };
      queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) => [...(old || []), optimisticMsg]);

      const savedInput = inputValue.trim();
      const savedMedia = pendingMedia;
      setInputValue('');
      setPendingMedia(null);

      try {
        // Get MAX bot token from messenger_settings
        const { data: maxSettings } = await supabase
          .from('messenger_settings')
          .select('config')
          .eq('channel', 'max')
          .eq('is_active', true)
          .maybeSingle();

        const maxConfig = maxSettings?.config as Record<string, unknown> | null;
        const botToken = maxConfig?.bot_token as string;
        if (!botToken) throw new Error('MAX не настроен');

        const { data, error } = await supabase.functions.invoke('send-max-message', {
          body: {
            bot_token: botToken,
            chat_id: selectedClientId, // In a real scenario, this would be the MAX chat_id
            message: savedInput,
            client_id: selectedClientId,
            ...(savedMedia ? { media_url: savedMedia.mediaUrl, media_type: savedMedia.mediaType, file_name: savedMedia.fileName } : {}),
          },
        });

        if (error && !data) throw error;
        if (!data?.success) {
          queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
            (old || []).map(m => m.id === optimisticId ? { ...m, delivery_status: 'error' as const, _error: data?.error || 'Ошибка' } : m)
          );
          toast.error(data?.error || 'Ошибка отправки MAX');
          return;
        }

        await (supabase.from('messages' as any).insert([{
          client_id: selectedClientId, user_id: user.id, manager_id: user.id,
          content: savedInput || (savedMedia ? `[${savedMedia.mediaType}]` : ''),
          direction: 'out', channel: 'max', is_internal: false, is_read: true,
          message_type: savedMedia ? savedMedia.mediaType : 'text',
          media_url: savedMedia?.mediaUrl || null, media_type: savedMedia?.mediaType || null,
          external_message_id: data.message_id ? `max_${data.message_id}` : null,
          delivery_status: 'sent',
        }]) as any);

        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) => (old || []).filter(m => m.id !== optimisticId));
        queryClient.invalidateQueries({ queryKey: ['messages', selectedClientId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } catch (err: any) {
        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
          (old || []).map(m => m.id === optimisticId ? { ...m, delivery_status: 'error' as const, _error: err?.message || 'Ошибка' } : m)
        );
        toast.error(`Ошибка MAX: ${err?.message || 'Неизвестная ошибка'}`);
      }
      return;
    }

    // MAX Web Bridge channel — send via max-bridge-send edge function
    if (channel === 'max_web') {
      const hasMedia = !!pendingMedia;
      const hasText = !!inputValue.trim();
      if (!hasMedia && !hasText) return;

      const optimisticId = `optimistic_${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId, client_id: selectedClientId, user_id: user.id, manager_id: user.id,
        content: inputValue.trim() || (hasMedia ? `[${pendingMedia!.mediaType}]` : ''),
        direction: 'out', channel: 'max_web', is_internal: false, is_read: true, is_automated: false,
        template_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        external_message_id: null, media_url: hasMedia ? pendingMedia!.mediaUrl : null,
        media_type: hasMedia ? pendingMedia!.mediaType : null,
        message_type: hasMedia ? pendingMedia!.mediaType : 'text',
        delivery_status: 'pending', _optimistic: true,
      };
      queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) => [...(old || []), optimisticMsg]);

      const savedInput = inputValue.trim();
      const savedMedia = pendingMedia;
      setInputValue('');
      setPendingMedia(null);

      try {
        const cleanPhone = selectedConv.client_phone.replace(/\D/g, '');
        const { data, error } = await supabase.functions.invoke('max-bridge-send', {
          body: {
            phone: cleanPhone,
            message: savedInput,
            client_id: selectedClientId,
            ...(savedMedia ? { media_url: savedMedia.mediaUrl, media_type: savedMedia.mediaType, file_name: savedMedia.fileName } : {}),
          },
        });

        if (error && !data) throw error;
        if (!data?.success) {
          queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
            (old || []).map(m => m.id === optimisticId ? { ...m, delivery_status: 'error' as const, _error: data?.error || 'Ошибка' } : m)
          );
          toast.error(data?.error || 'Ошибка отправки MAX Web');
          return;
        }

        await (supabase.from('messages' as any).insert([{
          client_id: selectedClientId, user_id: user.id, manager_id: user.id,
          content: savedInput || (savedMedia ? `[${savedMedia.mediaType}]` : ''),
          direction: 'out', channel: 'max_web', is_internal: false, is_read: true,
          message_type: savedMedia ? savedMedia.mediaType : 'text',
          media_url: savedMedia?.mediaUrl || null, media_type: savedMedia?.mediaType || null,
          external_message_id: data.message_id ? `maxweb_${data.message_id}` : null,
          delivery_status: 'sent',
        }]) as any);

        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) => (old || []).filter(m => m.id !== optimisticId));
        queryClient.invalidateQueries({ queryKey: ['messages', selectedClientId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      } catch (err: any) {
        queryClient.setQueryData<Message[]>(['messages', selectedClientId], (old) =>
          (old || []).map(m => m.id === optimisticId ? { ...m, delivery_status: 'error' as const, _error: err?.message || 'Ошибка' } : m)
        );
        toast.error(`Ошибка MAX Web: ${err?.message || 'Неизвестная ошибка'}`);
      }
    }

    // Non-Telegram/MAX channels — simple DB insert
    if (!inputValue.trim()) return;
    sendMessage({
      client_id: selectedClientId,
      content: inputValue.trim(),
      channel,
      is_internal: false,
    });
    setInputValue('');
  }, [selectedClientId, selectedConv, inputValue, isNoteMode, pendingMedia, tgConfigured, telegramConfig, user, queryClient, sendMessage]);

  // Resend a failed message — passes refresh_session to re-read session from DB
  const handleResend = useCallback(async (msg: Message) => {
    if (!user || !telegramConfig) return;
    const conv = conversations.find(c => c.client_id === msg.client_id);
    if (!conv) { toast.error('Диалог не найден'); return; }

    queryClient.setQueryData<Message[]>(['messages', msg.client_id], (old) =>
      (old || []).map(m => m.id === msg.id ? { ...m, delivery_status: 'pending' as const, _error: undefined } : m)
    );
    if (!msg._optimistic) {
      await (supabase.from('messages' as any).update({ delivery_status: 'pending' }).eq('id', msg.id) as any);
    }

    try {
      const cleanPhone = conv.client_phone.replace(/\D/g, '');
      const { data, error } = await supabase.functions.invoke('send-telegram-message', {
        body: {
          ...telegramConfig,
          phone: cleanPhone,
          message: msg.content,
          client_id: msg.client_id,
          refresh_session: true,
          user_id: user.id,
          ...(msg.media_url && msg.media_type ? { media_url: msg.media_url, media_type: msg.media_type } : {}),
        },
      });
      if (error && !data) throw error;
      if (!data?.success) {
        queryClient.setQueryData<Message[]>(['messages', msg.client_id], (old) =>
          (old || []).map(m => m.id === msg.id ? { ...m, delivery_status: 'error' as const, _error: data?.error || 'Ошибка' } : m)
        );
        if (!msg._optimistic) await (supabase.from('messages' as any).update({ delivery_status: 'error' }).eq('id', msg.id) as any);
        showTelegramError(data, msg);
        return;
      }
      if (!msg._optimistic) {
        await (supabase.from('messages' as any).update({ delivery_status: 'sent', external_message_id: data.message_id ? `tg_${data.message_id}` : null }).eq('id', msg.id) as any);
      }
      queryClient.setQueryData<Message[]>(['messages', msg.client_id], (old) =>
        (old || []).map(m => m.id === msg.id ? { ...m, delivery_status: 'sent' as const, _error: undefined, _optimistic: false } : m)
      );
      queryClient.invalidateQueries({ queryKey: ['messages', msg.client_id] });
      toast.success('Сообщение отправлено');
    } catch (err: any) {
      queryClient.setQueryData<Message[]>(['messages', msg.client_id], (old) =>
        (old || []).map(m => m.id === msg.id ? { ...m, delivery_status: 'error' as const, _error: err?.message || 'Ошибка' } : m)
      );
      if (!msg._optimistic) await (supabase.from('messages' as any).update({ delivery_status: 'error' }).eq('id', msg.id) as any);
      toast.error(`Ошибка: ${err?.message || 'Неизвестная ошибка'}`);
    }
  }, [user, telegramConfig, conversations, queryClient, showTelegramError]);

  // Delete a failed message
  const handleDelete = useCallback(async (msg: Message) => {
    queryClient.setQueryData<Message[]>(['messages', msg.client_id], (old) =>
      (old || []).filter(m => m.id !== msg.id)
    );
    if (!msg._optimistic) {
      await (supabase.from('messages' as any).delete().eq('id', msg.id) as any);
    }
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    toast.success('Сообщение удалено');
  }, [queryClient]);

  const handleTemplateSelect = (template: any) => {
    // Replace placeholders
    let text = template.message_template;
    if (selectedConv) {
      text = text.replace(/\{\{name\}\}/g, `${selectedConv.client_first_name} ${selectedConv.client_last_name}`);
    }
    setInputValue(text);
    setShowTemplates(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartChat = async (params: {
    clientId: string;
    clientName: string;
    channel: MessageChannel;
    firstMessage: string;
    isNewClient: boolean;
  }) => {
    sendMessage({
      client_id: params.clientId,
      content: params.firstMessage,
      channel: params.channel,
      is_internal: false,
    });
    if (params.isNewClient) {
      setNewClientIds(prev => new Set(prev).add(params.clientId));
    }
    setSelectedClientId(params.clientId);
    setNewChatOpen(false);
  };

  const handleFillClientDetails = (clientId: string) => {
    window.open(`/clients?edit=${clientId}`, '_blank');
  };

  const handleArchiveChat = useCallback(async (reason: string) => {
    if (!selectedClientId) return;
    await (supabase
      .from('clients')
      .update({ is_archived: true, archive_reason: reason } as any)
      .eq('id', selectedClientId) as any);
    queryClient.invalidateQueries({ queryKey: ['archived-clients'] });
    setSelectedClientId(null);
    toast.success('Диалог завершён');
  }, [selectedClientId, queryClient]);

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Центр связи</h1>
            <p className="text-muted-foreground text-sm">
              {commView === 'messenger' ? (totalUnread > 0 ? `${totalUnread} непрочитанных` : 'Все прочитано') : commView === 'chat' ? 'Внутренний чат' : 'Электронная почта'}
            </p>
          </div>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setCommView('messenger')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', commView === 'messenger' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <MessageCircle className="h-4 w-4 inline mr-1.5" />Мессенджеры
            </button>
            <button onClick={() => setCommView('email')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', commView === 'email' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Mail className="h-4 w-4 inline mr-1.5" />Почта
            </button>
            <button onClick={() => setCommView('chat')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', commView === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <MessageSquare className="h-4 w-4 inline mr-1.5" />Чат
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tgConfigured && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => pollMessages()}
              disabled={isSyncing}
              title="Проверить новые сообщения в Telegram"
            >
              <RefreshCw className={cn('h-5 w-5', isSyncing && 'animate-spin')} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={toggleMute} title={isMuted ? 'Включить звук' : 'Выключить звук'}>
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {commView === 'email' ? (
        <div className="flex-1 min-h-0 card-elevated overflow-hidden">
          <EmailInbox initialEmailId={initialEmailId} />
        </div>
      ) : commView === 'chat' ? (
        <InternalChat />
      ) : (
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Conversations list */}
        <div className="w-80 shrink-0 flex flex-col card-elevated">
          <div className="p-3 space-y-2">
            <ChatFilterTabs value={chatFilter} onChange={setChatFilter} unreadCount={totalUnread} autopilotCount={conversations.filter(c => !archivedClients?.has(c.client_id) && c.last_is_automated).length} onNewChat={() => setNewChatOpen(true)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по ФИО или тексту..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {chatFilter === 'unread' ? 'Нет непрочитанных' : chatFilter === 'my' ? 'Нет ваших диалогов' : chatFilter === 'autopilot' ? 'Нет диалогов от автопилота' : 'Нет диалогов'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(conv => {
                  const pinned = isPinned(conv.client_id);
                  const searchSnippet = isSearchInMessages ? snippetMap.get(conv.client_id) : null;
                  return (
                    <button
                      key={conv.client_id}
                      onClick={() => setSelectedClientId(conv.client_id)}
                      className={cn(
                        'w-full text-left p-3 hover:bg-muted/40 transition-colors group',
                        selectedClientId === conv.client_id && 'bg-primary/5 border-l-2 border-l-primary',
                        pinned && 'bg-muted/20'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="avatar-initials h-9 w-9 text-xs shrink-0">
                          {conv.client_last_name.charAt(0)}{conv.client_first_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                              {pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                              {conv.client_last_name} {conv.client_first_name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePin(conv.client_id); }}
                                className={cn(
                                  'h-5 w-5 flex items-center justify-center rounded transition-opacity',
                                  pinned ? 'opacity-70 hover:opacity-100' : 'opacity-0 group-hover:opacity-50 hover:!opacity-100'
                                )}
                                title={pinned ? 'Открепить' : 'Закрепить'}
                              >
                                {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                              </button>
                              {conv.unread_count > 0 && (
                                <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-[20px] flex items-center justify-center">
                                  {conv.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                            {searchSnippet ? (
                              <span className="text-primary/80">🔍 {searchSnippet}</span>
                            ) : (
                              <>
                                {conv.last_is_automated && <Bot className="h-3 w-3 text-primary shrink-0" />}
                                <ChannelIcon channel={conv.last_channel} size={12} /> {conv.last_message}
                              </>
                            )}
                          </p>
                          <span className="text-[10px] text-muted-foreground/70">
                            {format(new Date(conv.last_message_at), 'dd MMM HH:mm', { locale: ru })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col card-elevated min-w-0 overflow-hidden">
          {!selectedClientId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Выберите диалог слева</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <TooltipProvider delayDuration={200}>
                    <div className="relative">
                      <div className="avatar-initials h-9 w-9 text-xs">
                        {selectedConv?.client_last_name.charAt(0)}{selectedConv?.client_first_name.charAt(0)}
                      </div>
                      {selectedClientId && onlineStatuses[selectedClientId] && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background cursor-default',
                              onlineStatuses[selectedClientId].is_online ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'
                            )} />
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {onlineStatuses[selectedClientId].is_online
                              ? 'Онлайн'
                              : onlineStatuses[selectedClientId].last_seen === 'recently'
                                ? 'Был(а) недавно'
                                : onlineStatuses[selectedClientId].last_seen
                                  ? `Был(а) ${new Date(onlineStatuses[selectedClientId].last_seen!).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                  : 'Оффлайн'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TooltipProvider>
                  <div>
                    <p className="text-sm font-medium">{selectedConv?.client_last_name} {selectedConv?.client_first_name}</p>
                    <div className="text-xs text-muted-foreground">
                      {selectedConv && (
                        <MaskedPhone
                          phone={selectedConv.client_phone}
                          clientId={selectedConv.client_id}
                          clientName={`${selectedConv.client_last_name} ${selectedConv.client_first_name}`}
                          context="Центр связи"
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <TooltipProvider delayDuration={200}>
                  <div className="flex items-center gap-1">
                    {tgConfigured && selectedConv?.last_channel === 'telegram' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            disabled={isSyncing}
                            onClick={() => {
                              if (selectedClientId && selectedConv?.client_phone) {
                                backfillChat(selectedClientId, selectedConv.client_phone);
                              }
                            }}
                          >
                            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Загрузить историю</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Передать чат другому менеджеру</TooltipContent>
                    </Tooltip>
                    <ArchiveChatDialog onArchive={handleArchiveChat} />
                  </div>
                </TooltipProvider>
              </div>

              {/* New client banner */}
              {selectedClientId && newClientIds.has(selectedClientId) && (
                <NewClientBanner
                  clientName={`${selectedConv?.client_last_name} ${selectedConv?.client_first_name}`}
                  onFillDetails={() => handleFillClientDetails(selectedClientId)}
                />
              )}

              {/* Session expired banner */}
              {sessionExpired && tgConfigured && telegramConfig && selectedConv && (
                <SessionExpiredBanner
                  onSessionRestored={async (sessionString) => {
                    // Save new session to messenger_settings
                    const existing = await supabase
                      .from('messenger_settings')
                      .select('id, config')
                      .eq('channel', 'telegram')
                      .maybeSingle();
                    if (existing.data) {
                      const cfg = existing.data.config as Record<string, unknown>;
                      await supabase
                        .from('messenger_settings')
                        .update({ config: { ...cfg, session_string: sessionString } as any })
                        .eq('id', existing.data.id);
                    }
                    setSessionExpired(false);
                    // Add system message
                    if (selectedClientId && user) {
                      await (supabase.from('messages' as any).insert([{
                        client_id: selectedClientId,
                        user_id: user.id,
                        manager_id: user.id,
                        content: 'Сессия обновлена. Связь восстановлена.',
                        direction: 'out',
                        channel: 'telegram',
                        is_internal: true,
                        is_read: true,
                        message_type: 'text',
                        delivery_status: 'sent',
                      }]) as any);
                      queryClient.invalidateQueries({ queryKey: ['messages', selectedClientId] });
                    }
                  }}
                  onDismiss={() => setSessionExpired(false)}
                  pendingRetry={pendingRetryMsg ? () => {
                    handleResend(pendingRetryMsg);
                    setPendingRetryMsg(null);
                  } : undefined}
                />
              )}

              {/* Messages */}
              <div className="flex-1 min-h-0 relative">
                <div
                  ref={scrollAreaRef}
                  className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4"
                  onScroll={handleMessagesScroll as any}
                >
                  <div className="space-y-3 max-w-full">
                    {clientMessagesResult.isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Нет сообщений</p>
                    ) : (
                      messages.map(msg => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isOwn={msg.user_id === user?.id}
                          onResend={handleResend}
                          onDelete={handleDelete}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <ScrollToBottomButton
                  visible={isScrolledUp}
                  newCount={newMsgCount}
                  onClick={() => scrollToBottom()}
                />
              </div>

              {/* Input area */}
              <div className="p-3 border-t border-border shrink-0">
                {/* Template suggestions */}
                {showTemplates && templates && templates.length > 0 && (
                  <div className="mb-2 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {templates
                      .filter(t => t.title.toLowerCase().includes(inputValue.slice(1).toLowerCase()) || inputValue === '/')
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleTemplateSelect(t)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-medium">{t.title}</span>
                          <span className="text-xs text-muted-foreground ml-2 truncate">
                            {t.message_template.slice(0, 50)}...
                          </span>
                        </button>
                      ))}
                  </div>
                )}

                {/* Pending media preview */}
                {pendingMedia && (
                  <div className="mb-2 p-2 bg-muted/50 rounded-lg flex items-center gap-2">
                    {pendingMedia.mediaType === 'photo' ? (
                      <img src={pendingMedia.mediaUrl} alt="" className="h-12 w-12 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <span className="text-lg">
                          {pendingMedia.mediaType === 'voice' || pendingMedia.mediaType === 'audio' ? '🎤' : '📄'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{pendingMedia.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">{pendingMedia.mediaType}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPendingMedia(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Note/Client toggle */}
                  <Button
                    variant={isNoteMode ? 'default' : 'ghost'}
                    size="icon"
                    className={cn('h-9 w-9 shrink-0', isNoteMode && 'bg-warning text-warning-foreground hover:bg-warning/90')}
                    onClick={() => setIsNoteMode(!isNoteMode)}
                    title={isNoteMode ? 'Режим заметки' : 'Режим клиенту'}
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>

                  {/* Attach media — only for Telegram */}
                  {tgConfigured && selectedConv?.last_channel === 'telegram' && !isNoteMode && (
                    <ChatMediaAttachment
                      onAttach={(att) => setPendingMedia(att)}
                      disabled={isSending || isSendingTg}
                    />
                  )}

                  <Input
                    value={inputValue}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isNoteMode ? 'Внутренняя заметка...' : pendingMedia ? 'Подпись (необязательно)...' : 'Введите сообщение... (/ для шаблонов)'}
                    className={cn('flex-1', isNoteMode && 'border-warning/50 bg-warning/5')}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleSend}
                    disabled={(!inputValue.trim() && !pendingMedia) || isSending || isSendingTg}
                  >
                    {isSendingTg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                {isNoteMode && (
                  <p className="text-[10px] text-warning mt-1 ml-11">
                    📝 Заметка видна только сотрудникам
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onStartChat={handleStartChat}
      />
    </div>
  );
}
