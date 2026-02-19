import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SessionExpiredBannerProps {
  onSessionRestored: (sessionString: string) => void;
  onDismiss: () => void;
  pendingRetry?: () => void;
}

function sanitizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function SessionExpiredBanner({
  onSessionRestored,
  onDismiss,
  pendingRetry,
}: SessionExpiredBannerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'prompt' | 'code' | '2fa'>('prompt');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [tempSession, setTempSession] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Credentials fetched from DB
  const [creds, setCreds] = useState<{ api_id: string; api_hash: string; phone: string } | null>(null);

  const fetchCredsFromDB = useCallback(async (): Promise<{ api_id: string; api_hash: string; phone: string } | null> => {
    if (creds) return creds;
    if (!user) return null;

    const { data, error } = await supabase
      .from('messenger_settings')
      .select('config')
      .eq('channel', 'telegram')
      .maybeSingle();

    if (error || !data?.config) {
      toast.error('Ошибка: Настройки мессенджера не найдены в базе');
      console.error('SessionExpiredBanner: messenger_settings not found', error);
      return null;
    }

    const cfg = data.config as Record<string, unknown>;
    const api_id = cfg.api_id as string;
    const api_hash = cfg.api_hash as string;
    const phone = cfg.auth_phone as string;

    if (!api_id || !api_hash || !phone) {
      toast.error('Ошибка: API ID, API Hash или телефон не заполнены в настройках');
      console.error('SessionExpiredBanner: missing credentials', { api_id: !!api_id, api_hash: !!api_hash, phone: !!phone });
      return null;
    }

    const result = { api_id, api_hash, phone: sanitizePhone(phone) };
    setCreds(result);
    return result;
  }, [user, creds]);

  const handleSendCode = async () => {
    setIsLoading(true);
    try {
      const credentials = await fetchCredsFromDB();
      if (!credentials) {
        setIsLoading(false);
        return;
      }

      console.log('SessionExpiredBanner: sending code', {
        api_id: credentials.api_id,
        phone: credentials.phone,
        api_hash_length: credentials.api_hash.length,
      });

      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'send_code',
          api_id: credentials.api_id,
          api_hash: credentials.api_hash,
          phone: credentials.phone,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.status === 'code_requested') {
        setPhoneCodeHash(data.phone_code_hash);
        setTempSession(data.session_string);
        setStep('code');
        toast.success('Код отправлен в Telegram');
      }
    } catch (err: any) {
      console.error('SessionExpiredBanner: sendCode error', err);
      toast.error(err.message || 'Ошибка отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 4) return;
    const credentials = creds;
    if (!credentials) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'sign_in',
          api_id: credentials.api_id,
          api_hash: credentials.api_hash,
          phone: credentials.phone,
          phone_code_hash: phoneCodeHash,
          code,
          session_string: tempSession,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.status === '2fa_needed') {
        setTempSession(data.session_string);
        setStep('2fa');
        return;
      }
      if (data?.status === 'authorized') {
        handleSuccess(data.session_string);
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка верификации');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FA = async () => {
    if (!password) return;
    const credentials = creds;
    if (!credentials) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'sign_in_2fa',
          api_id: credentials.api_id,
          api_hash: credentials.api_hash,
          session_string: tempSession,
          password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.status === 'authorized') {
        handleSuccess(data.session_string);
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = (sessionString: string) => {
    onSessionRestored(sessionString);
    queryClient.invalidateQueries({ queryKey: ['telegram-config-sync'] });
    queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
    toast.success('Сессия Telegram восстановлена');
    if (pendingRetry) {
      setTimeout(pendingRetry, 500);
    }
  };

  return (
    <div className="mx-3 mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
      {step === 'prompt' && (
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">Сессия Telegram истекла</p>
            <p className="text-xs text-muted-foreground">Необходимо обновить подключение для отправки сообщений</p>
          </div>
          <Button size="sm" variant="destructive" onClick={handleSendCode} disabled={isLoading} className="shrink-0 gap-1.5">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {isLoading ? 'Отправка запроса...' : 'Обновить подключение'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="shrink-0 text-xs">
            ✕
          </Button>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Введите код из Telegram
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="12345"
              maxLength={6}
              autoFocus
              className="font-mono text-center tracking-widest max-w-[140px]"
            />
            <Button size="sm" onClick={handleVerify} disabled={isLoading || code.length < 4}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Подтвердить'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>✕</Button>
          </div>
        </div>
      )}

      {step === '2fa' && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Введите облачный пароль (2FA)
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Облачный пароль"
              autoFocus
              className="max-w-[200px]"
            />
            <Button size="sm" onClick={handle2FA} disabled={isLoading || !password}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Подтвердить'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>✕</Button>
          </div>
        </div>
      )}
    </div>
  );
}
