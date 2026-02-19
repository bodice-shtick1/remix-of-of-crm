import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { KeyRound, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { TelegramAuthDialog } from './TelegramAuthDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TelegramSettingsFormProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  existingStatus?: string;
}

function sanitizePhone(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

export function TelegramSettingsForm({ config, updateConfig, existingStatus }: TelegramSettingsFormProps) {
  const { user } = useAuth();
  const connectionType = (config.connection_type as string) || 'bot';
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const isAuthorized = !!(config.session_string as string);

  // Dynamic session check
  const [sessionCheck, setSessionCheck] = useState<'idle' | 'checking' | 'valid' | 'expired'>('idle');
  const [sessionUser, setSessionUser] = useState<{ first_name?: string; username?: string } | null>(null);

  const checkSession = useCallback(async () => {
    if (!user || connectionType !== 'user_api' || !isAuthorized) return;
    setSessionCheck('checking');
    try {
      const { data, error } = await supabase.functions.invoke('check-telegram-session', {
        body: { user_id: user.id },
      });
      if (error && !data) throw error;
      if (data?.valid) {
        setSessionCheck('valid');
        setSessionUser(data.user || null);
      } else if (data?.session_expired) {
        setSessionCheck('expired');
        setSessionUser(null);
      } else {
        setSessionCheck('valid'); // non-session errors don't mean expired
      }
    } catch {
      setSessionCheck('idle');
    }
  }, [user, connectionType, isAuthorized]);

  useEffect(() => {
    if (isAuthorized && connectionType === 'user_api') {
      checkSession();
    }
  }, [isAuthorized, connectionType, checkSession]);

  const canAuthorize = !!(config.api_id as string) && !!(config.api_hash as string) && !!(config.auth_phone as string);

  const handleReAuth = () => {
    setAuthDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Тип подключения</Label>
        <RadioGroup
          value={connectionType}
          onValueChange={v => updateConfig('connection_type', v)}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="bot" id="tg-type-bot" />
            <Label htmlFor="tg-type-bot" className="cursor-pointer font-normal">Бот</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="user_api" id="tg-type-api" />
            <Label htmlFor="tg-type-api" className="cursor-pointer font-normal">Личный аккаунт (API)</Label>
          </div>
        </RadioGroup>
      </div>

      {connectionType === 'bot' && (
        <div className="space-y-2">
          <Label htmlFor="tg-bot-token">Bot Token</Label>
          <Input
            id="tg-bot-token"
            type="password"
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            value={(config.bot_token as string) || ''}
            onChange={e => updateConfig('bot_token', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Получите токен у @BotFather в Telegram
          </p>
        </div>
      )}

      {connectionType === 'user_api' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tg-api-id">API ID</Label>
              <Input
                id="tg-api-id"
                placeholder="12345678"
                value={(config.api_id as string) || ''}
                onChange={e => updateConfig('api_id', e.target.value)}
                disabled={isAuthorized && sessionCheck !== 'expired'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg-api-hash">API Hash</Label>
              <Input
                id="tg-api-hash"
                type="password"
                placeholder="0123456789abcdef..."
                value={(config.api_hash as string) || ''}
                onChange={e => updateConfig('api_hash', e.target.value)}
                disabled={isAuthorized && sessionCheck !== 'expired'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tg-phone">Номер телефона аккаунта</Label>
            <Input
              id="tg-phone"
              placeholder="+79991234567"
              value={(config.auth_phone as string) || ''}
              onChange={e => updateConfig('auth_phone', sanitizePhone(e.target.value))}
              disabled={isAuthorized && sessionCheck !== 'expired'}
            />
            <p className="text-xs text-muted-foreground">
              Формат: +7XXXXXXXXXX (международный)
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Получите API ID и API Hash на{' '}
            <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              my.telegram.org
            </a>
          </p>

          {/* Session status block */}
          {isAuthorized && sessionCheck === 'checking' && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Проверка сессии...</span>
            </div>
          )}

          {isAuthorized && sessionCheck === 'valid' && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <span className="text-sm text-primary font-medium">Сессия активна</span>
                {sessionUser?.first_name && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({sessionUser.first_name}{sessionUser.username ? ` @${sessionUser.username}` : ''})
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs gap-1"
                onClick={checkSession}
              >
                <RefreshCw className="h-3 w-3" />
                Проверить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => updateConfig('session_string', '')}
              >
                Сбросить
              </Button>
            </div>
          )}

          {isAuthorized && sessionCheck === 'expired' && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div className="flex-1">
                <span className="text-sm text-destructive font-medium">Сессия истекла</span>
                <p className="text-xs text-muted-foreground">Необходима переавторизация для отправки сообщений</p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleReAuth}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Переавторизоваться
              </Button>
            </div>
          )}

          {isAuthorized && sessionCheck === 'idle' && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">Сессия авторизована</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => updateConfig('session_string', '')}
              >
                Сбросить
              </Button>
            </div>
          )}

          {!isAuthorized && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!canAuthorize}
              onClick={() => setAuthDialogOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              Авторизоваться
            </Button>
          )}

          <TelegramAuthDialog
            open={authDialogOpen}
            onOpenChange={setAuthDialogOpen}
            apiId={(config.api_id as string) || ''}
            apiHash={(config.api_hash as string) || ''}
            phone={(config.auth_phone as string) || ''}
            onAuthorized={(sessionString) => {
              updateConfig('session_string', sessionString);
              setAuthDialogOpen(false);
              setSessionCheck('valid');
              toast.success('Авторизация успешна');
            }}
          />
        </>
      )}

      {/* Broadcast interval setting */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Интервал между сообщениями в рассылке</Label>
        </div>
        <div className="flex items-center gap-4">
          <Slider
            value={[((config.broadcast_interval as number) || 20)]}
            onValueChange={([val]) => updateConfig('broadcast_interval', val)}
            min={5}
            max={60}
            step={1}
            className="flex-1"
          />
          <span className="text-sm font-mono text-muted-foreground w-12 text-right">
            {((config.broadcast_interval as number) || 20)} сек
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Минимальная пауза между отправками при массовой рассылке (5–60 сек). Рекомендуется 20+ сек для личных аккаунтов.
        </p>
      </div>
    </div>
  );
}
