import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, Phone, Send, MessageCircle, Loader2, CheckCircle2, XCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { ChannelIcon } from '@/components/icons/MessengerIcons';
import { cn } from '@/lib/utils';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';
import { maskPhone } from '@/hooks/useContactMasking';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MessageChannel } from '@/hooks/useMessages';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (params: {
    clientId: string;
    clientName: string;
    channel: MessageChannel;
    firstMessage: string;
    isNewClient: boolean;
    telegramUsername?: string;
  }) => void;
}

type ChannelStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'privacy_restricted';

interface TelegramUserInfo {
  username?: string;
  first_name?: string;
  last_name?: string;
  user_id?: string;
}

interface ChannelAvailability {
  whatsapp: ChannelStatus;
  telegram: ChannelStatus;
  max: ChannelStatus;
  telegramUser?: TelegramUserInfo;
}

const CHANNELS: { value: MessageChannel; label: string; checkable: boolean }[] = [
  { value: 'whatsapp', label: 'WhatsApp', checkable: true },
  { value: 'telegram', label: 'Telegram', checkable: true },
  { value: 'max', label: 'Макс', checkable: true },
  { value: 'sms', label: 'СМС', checkable: false },
];

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '+7 ';
  let result = '+7 ';
  const d = digits.startsWith('7') ? digits.slice(1) : digits.startsWith('8') ? digits.slice(1) : digits;
  if (d.length > 0) result += `(${d.slice(0, 3)}`;
  if (d.length >= 3) result += ') ';
  if (d.length > 3) result += d.slice(3, 6);
  if (d.length > 6) result += `-${d.slice(6, 8)}`;
  if (d.length > 8) result += `-${d.slice(8, 10)}`;
  return result;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function toInternational(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.startsWith('8') && digits.length === 11) return '7' + digits.slice(1);
  if (digits.startsWith('7')) return digits;
  if (digits.length === 10) return '7' + digits;
  return digits;
}

function ChannelStatusIcon({ status }: { status: ChannelStatus }) {
  if (status === 'checking') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (status === 'available') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === 'privacy_restricted') return <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />;
  if (status === 'unavailable') return <XCircle className="h-3.5 w-3.5 text-destructive/60" />;
  return null;
}

export function NewChatDialog({ open, onOpenChange, onStartChat }: NewChatDialogProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'search' | 'compose'>('search');
  const [channelAvailability, setChannelAvailability] = useState<ChannelAvailability>({
    whatsapp: 'idle',
    telegram: 'idle',
    max: 'idle',
  });

  // Fetch Telegram settings (session_string) for contact search
  const { data: telegramConfig } = useQuery({
    queryKey: ['telegram-config-for-search'],
    queryFn: async () => {
      const { data } = await supabase
        .from('messenger_settings')
        .select('config')
        .eq('channel', 'telegram')
        .maybeSingle();

      if (!data?.config) return null;
      const cfg = data.config as Record<string, unknown>;
      if (cfg.connection_type === 'user_api' && cfg.session_string) {
        return {
          api_id: cfg.api_id as string,
          api_hash: cfg.api_hash as string,
          session_string: cfg.session_string as string,
        };
      }
      return null;
    },
    enabled: !!user && open,
    staleTime: 60_000,
  });

  // Fetch MAX settings for contact check
  const { data: maxConfig } = useQuery({
    queryKey: ['max-config-for-search'],
    queryFn: async () => {
      const { data } = await supabase
        .from('messenger_settings')
        .select('config')
        .eq('channel', 'max')
        .eq('is_active', true)
        .maybeSingle();

      if (!data?.config) return null;
      const cfg = data.config as Record<string, unknown>;
      if (cfg.bot_token) {
        return { bot_token: cfg.bot_token as string };
      }
      return null;
    },
    enabled: !!user && open,
    staleTime: 60_000,
  });

  const phoneToCheck = selectedClient?.phone || (step === 'compose' ? phoneInput : '');
  // Normalize for API: strip everything, ensure international format
  const normalizedPhoneToCheck = toInternational(normalizePhone(phoneToCheck));

  // Check channel availability when entering compose step
  useEffect(() => {
    if (step !== 'compose' || !normalizedPhoneToCheck || normalizedPhoneToCheck.length < 10) return;

    const checkChannels = async () => {
      setChannelAvailability({
        whatsapp: 'checking',
        telegram: 'checking',
        max: 'checking',
      });

      try {
        const { data, error } = await supabase.functions.invoke('check-channels', {
          body: {
            phone: normalizedPhoneToCheck,
            telegram_config: telegramConfig || undefined,
            max_config: maxConfig || undefined,
          },
        });

        if (error) throw error;

        const result = data as {
          whatsapp: { available: boolean };
          telegram: { available: boolean; privacy_restricted?: boolean; username?: string; first_name?: string; last_name?: string; user_id?: string };
          max: { available: boolean; first_name?: string; last_name?: string; username?: string; user_id?: string };
        };

        const getTelegramStatus = (): ChannelStatus => {
          if (result.telegram.available) return 'available';
          if (result.telegram.privacy_restricted) return 'privacy_restricted';
          return 'unavailable';
        };

        const newAvailability: ChannelAvailability = {
          whatsapp: result.whatsapp.available ? 'available' : 'unavailable',
          telegram: getTelegramStatus(),
          max: result.max.available ? 'available' : 'unavailable',
          telegramUser: result.telegram.available ? {
            username: result.telegram.username,
            first_name: result.telegram.first_name,
            last_name: result.telegram.last_name,
            user_id: result.telegram.user_id,
          } : undefined,
        };

        setChannelAvailability(newAvailability);

        // Auto-select best available channel
        if (result.whatsapp.available) {
          setChannel('whatsapp');
        } else if (result.telegram.available) {
          setChannel('telegram');
        } else if (result.max.available) {
          setChannel('max');
        } else {
          setChannel('sms');
        }
      } catch (err) {
        console.error('Channel check failed:', err);
        setChannelAvailability({ whatsapp: 'unavailable', telegram: 'unavailable', max: 'unavailable' });
        setChannel('sms');
      }
    };

    checkChannels();
  }, [step, normalizedPhoneToCheck, telegramConfig, maxConfig]);

  // Search clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const normalizedSearch = search.replace(/\D/g, '');
      const isPhoneSearch = normalizedSearch.length >= 3;

      let query = supabase.from('clients').select('id, first_name, last_name, middle_name, phone').limit(20);

      if (isPhoneSearch) {
        query = query.ilike('phone', `%${normalizedSearch}%`);
      } else {
        query = query.or(`last_name.ilike.%${search}%,first_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && open && search.length >= 2,
    staleTime: 5_000,
  });

  // Templates
  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates-newchat'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true);
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const handleSelectClient = useCallback((client: typeof clients[0]) => {
    setSelectedClient({
      id: client.id,
      name: getClientDisplayName(client),
      phone: client.phone,
    });
    setStep('compose');
  }, []);

  const handleManualPhone = useCallback(() => {
    const digits = normalizePhone(phoneInput);
    if (digits.length < 10) return;
    setSelectedClient(null);
    setStep('compose');
  }, [phoneInput]);

  const handleTemplateSelect = useCallback((template: any) => {
    let text = template.message_template;
    if (selectedClient) {
      text = text.replace(/\{\{name\}\}/g, selectedClient.name);
    }
    setMessage(text);
  }, [selectedClient]);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;

    let clientId = selectedClient?.id || '';
    let clientName = selectedClient?.name || '';
    let isNewClient = false;

    if (!clientId) {
      const phone = toInternational(phoneInput);
      const { data, error } = await supabase
        .from('clients')
        .insert({
          first_name: 'Новый клиент',
          last_name: `(${formatPhoneDisplay(phone)})`,
          phone: phone,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create client:', error);
        return;
      }
      clientId = data.id;
      clientName = `Новый клиент (${formatPhoneDisplay(phone)})`;
      isNewClient = true;
    }

    onStartChat({
      clientId,
      clientName,
      channel,
      firstMessage: message.trim(),
      isNewClient,
      telegramUsername: channelAvailability.telegramUser?.username,
    });

    // Reset
    setSearch('');
    setSelectedClient(null);
    setPhoneInput('');
    setChannel('whatsapp');
    setMessage('');
    setStep('search');
    setChannelAvailability({ whatsapp: 'idle', telegram: 'idle', max: 'idle' });
  }, [message, selectedClient, phoneInput, channel, onStartChat, channelAvailability.telegramUser]);

  const handleClose = useCallback((val: boolean) => {
    if (!val) {
      setSearch('');
      setSelectedClient(null);
      setPhoneInput('');
      setMessage('');
      setStep('search');
      setChannelAvailability({ whatsapp: 'idle', telegram: 'idle', max: 'idle' });
    }
    onOpenChange(val);
  }, [onOpenChange]);

  const phoneDigits = normalizePhone(phoneInput);
  const isValidPhone = phoneDigits.length >= 10;
  const isChecking = channelAvailability.whatsapp === 'checking';
  const telegramPrivacyRestricted = channelAvailability.telegram === 'privacy_restricted';
  const allUnavailable = !isChecking &&
    channelAvailability.whatsapp === 'unavailable' &&
    (channelAvailability.telegram === 'unavailable' || telegramPrivacyRestricted) &&
    channelAvailability.max === 'unavailable';
  const tgUser = channelAvailability.telegramUser;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {step === 'search' ? 'Начать диалог' : 'Новое сообщение'}
          </DialogTitle>
        </DialogHeader>

        {step === 'search' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Имя или телефон клиента..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-60">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Поиск...</p>
              ) : clients.length > 0 ? (
                <div className="space-y-1">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectClient(c)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="avatar-initials h-8 w-8 text-[10px] shrink-0">
                        {getClientInitials(c)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getClientDisplayName(c)}</p>
                        <p className="text-xs text-muted-foreground">{maskPhone(c.phone)}</p>
                      </div>
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              ) : search.length >= 2 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Клиент не найден</p>
              ) : null}
            </ScrollArea>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Или введите номер вручную:</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="+7 (___) ___-__-__"
                    value={phoneInput ? formatPhoneDisplay(phoneInput) : ''}
                    onChange={e => setPhoneInput(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleManualPhone}
                  disabled={!isValidPhone}
                  size="sm"
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Далее
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected contact */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="avatar-initials h-9 w-9 text-xs shrink-0">
                {selectedClient ? (
                  <>{selectedClient.name.charAt(0)}</>
                ) : (
                  <Phone className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selectedClient?.name || 'Новый контакт'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedClient ? maskPhone(selectedClient.phone) : `+${normalizedPhoneToCheck || toInternational(normalizePhone(phoneInput))}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep('search')} className="text-xs shrink-0">
                Изменить
              </Button>
            </div>

            {/* Channel availability indicators */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Доступные каналы
                {isChecking && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    {telegramConfig ? '(поиск в Telegram через API...)' : '(проверка...)'}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                {CHANNELS.map(ch => {
                  const status = ch.checkable
                    ? channelAvailability[ch.value as keyof Pick<ChannelAvailability, 'whatsapp' | 'telegram' | 'max'>] as ChannelStatus
                    : 'idle';
                  const isSelected = channel === ch.value;

                  return (
                    <button
                      key={ch.value}
                      onClick={() => setChannel(ch.value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border text-xs font-medium transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/50 text-muted-foreground',
                        status === 'unavailable' && !isSelected && 'opacity-50',
                        status === 'privacy_restricted' && !isSelected && 'opacity-70 border-amber-500/30',
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          'transition-all',
                          status === 'available' && 'scale-110',
                        )}><ChannelIcon channel={ch.value} size={18} /></span>
                        <span className="hidden sm:inline">{ch.label}</span>
                      </div>
                      {ch.checkable && (
                        <ChannelStatusIcon status={status} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Telegram user info */}
              {tgUser && (
                <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs font-medium text-primary">
                    ✈️ Найден в Telegram
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ')}
                    {tgUser.username && <span className="ml-1 font-mono">@{tgUser.username}</span>}
                  </p>
                </div>
              )}

              {/* Telegram privacy restricted — offer direct link */}
              {telegramPrivacyRestricted && (
                <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Скрыто настройками приватности клиента
                  </p>
                  <a
                    href={`https://t.me/+${normalizedPhoneToCheck}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Написать через прямую ссылку
                  </a>
                </div>
              )}

              {/* SMS fallback hint */}
              {allUnavailable && !telegramPrivacyRestricted && (
                <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-xs font-medium text-amber-600">
                    📱 Мессенджеры не найдены, отправка через СМС
                  </p>
                </div>
              )}
            </div>

            {/* Quick templates */}
            {templates.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Быстрый ответ</label>
                <div className="flex flex-wrap gap-1.5">
                  {templates.slice(0, 6).map(t => (
                    <Badge
                      key={t.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/5 hover:border-primary transition-colors"
                      onClick={() => handleTemplateSelect(t)}
                    >
                      {t.title}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Message input */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Сообщение</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Введите первое сообщение..."
                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            {/* Send */}
            <Button onClick={handleSend} disabled={!message.trim() || isChecking} className="w-full gap-2">
              <Send className="h-4 w-4" />
              Отправить
              {channel === 'sms' && !isChecking && (
                <span className="text-xs opacity-70">(СМС)</span>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
