import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Save, Loader2, CircleDot } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { ChannelType, ConnectionStatus, MessengerSetting } from '@/hooks/useMessengerSettings';
import type { Json } from '@/integrations/supabase/types';
import { TelegramSettingsForm } from './TelegramSettingsForm';
import { MaxSettingsForm } from './MaxSettingsForm';
import { MaxWebBridgeForm } from './MaxWebBridgeForm';
import { WhatsAppWebBridgeForm } from './WhatsAppWebBridgeForm';

interface MessengerChannelCardProps {
  channel: ChannelType;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  existing?: MessengerSetting;
}

function StatusIndicator({ status, channel }: { status: ConnectionStatus; channel?: string }) {
  const map: Record<ConnectionStatus, { label: string; cls: string }> = {
    connected: {
      label: channel === 'max_web' ? 'Активен (Веб-сессия)' : channel === 'whatsapp_web' ? 'Активен (WhatsApp Web)' : 'Подключено',
      cls: 'text-green-600 bg-green-100',
    },
    error: { label: 'Ошибка', cls: 'text-destructive bg-destructive/10' },
    not_configured: { label: 'Не подключено', cls: 'text-muted-foreground bg-muted' },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cls)}>
      <CircleDot className="h-3 w-3" />
      {label}
    </span>
  );
}

export function MessengerChannelCard({
  channel,
  title,
  description,
  icon,
  accentClass,
  existing,
  onCollapse,
}: MessengerChannelCardProps & { onCollapse?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isActive, setIsActive] = useState(existing?.is_active ?? false);
  const [config, setConfig] = useState<Record<string, unknown>>(existing?.config ?? {});

  useEffect(() => {
    if (existing) {
      setIsActive(existing.is_active);
      setConfig(existing.config as Record<string, unknown>);
    }
  }, [existing]);

  const status: ConnectionStatus = existing?.status ?? 'not_configured';

  const saveMutation = useMutation({
    mutationKey: ['messenger-save', channel],
    mutationFn: async (params: {
      is_active: boolean;
      status: ConnectionStatus;
      config: Record<string, unknown>;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const configJson = params.config as unknown as Json;

      if (existing) {
        const { error } = await supabase
          .from('messenger_settings')
          .update({ is_active: params.is_active, status: params.status, config: configJson })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messenger_settings')
          .insert([{ user_id: user.id, channel, is_active: params.is_active, status: params.status, config: configJson }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
      toast.success(`Настройки ${title} сохранены`);
    },
    onError: (err: Error) => {
      toast.error(`Ошибка сохранения ${title}: ${err.message}`);
    },
  });

  const handleSave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    let newStatus: ConnectionStatus = 'not_configured';

    if (channel === 'whatsapp_web') {
      if (config.auth_payload) newStatus = 'connected';
    } else if (channel === 'whatsapp') {
      const phone = (config.phone as string) || '';
      const mode = (config.mode as string) || 'web';
      if (phone && (mode === 'web' || (config.api_key as string))) newStatus = 'connected';
    } else if (channel === 'telegram') {
      const connType = (config.connection_type as string) || 'bot';
      if (connType === 'bot' && (config.bot_token as string)?.length > 10) newStatus = 'connected';
      else if (connType === 'user_api' && (config.session_string as string)) newStatus = 'connected';
    } else if (channel === 'max') {
      if ((config.bot_token as string)?.length > 5) newStatus = 'connected';
    } else if (channel === 'max_web') {
      if (config.auth_payload) newStatus = 'connected';
    }

    saveMutation.mutate({ is_active: isActive, status: newStatus, config });
  }, [channel, config, isActive, saveMutation, title]);

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <AccordionItem value={channel} className="card-elevated overflow-hidden border-0">
      <AccordionTrigger className={cn('px-4 py-3 hover:no-underline [&>svg]:h-5 [&>svg]:w-5', accentClass)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon}
          <div className="text-left min-w-0">
            <h3 className="font-semibold text-foreground text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mr-2" onClick={e => e.stopPropagation()}>
          <StatusIndicator status={status} channel={channel} />
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <form
          id={`form-${channel}`}
          onSubmit={e => e.preventDefault()}
          className="p-4 pt-2 space-y-4"
        >
          {channel === 'whatsapp_web' && (
            <WhatsAppWebBridgeForm config={config} updateConfig={updateConfig} existingStatus={status} onCollapse={onCollapse} />
          )}

          {channel === 'whatsapp' && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${channel}-phone`}>Номер телефона отправителя</Label>
                <Input
                  id={`${channel}-phone`}
                  placeholder="+7 (999) 123-45-67"
                  value={(config.phone as string) || ''}
                  onChange={e => updateConfig('phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Режим работы</Label>
                <RadioGroup
                  value={(config.mode as string) || 'web'}
                  onValueChange={v => updateConfig('mode', v)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="web" id={`${channel}-wa-web`} />
                    <Label htmlFor={`${channel}-wa-web`} className="cursor-pointer font-normal">WhatsApp Web</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="business_api" id={`${channel}-wa-api`} />
                    <Label htmlFor={`${channel}-wa-api`} className="cursor-pointer font-normal">Business API</Label>
                  </div>
                </RadioGroup>
              </div>
              {(config.mode as string) === 'business_api' && (
                <div className="space-y-2">
                  <Label htmlFor={`${channel}-api-key`}>API-ключ WhatsApp Business</Label>
                  <Input
                    id={`${channel}-api-key`}
                    type="password"
                    placeholder="Введите API-ключ"
                    value={(config.api_key as string) || ''}
                    onChange={e => updateConfig('api_key', e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {channel === 'telegram' && (
            <TelegramSettingsForm config={config} updateConfig={updateConfig} existingStatus={status} />
          )}

          {channel === 'max' && (
            <MaxSettingsForm config={config} updateConfig={updateConfig} />
          )}

          {channel === 'max_web' && (
            <MaxWebBridgeForm config={config} updateConfig={updateConfig} existingStatus={status} onCollapse={onCollapse} />
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить настройки
          </Button>
        </form>
      </AccordionContent>
    </AccordionItem>
  );
}
