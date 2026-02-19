import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Wifi, Phone, KeyRound, ShieldCheck, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { ConnectionStatus } from '@/hooks/useMessengerSettings';
import type { Json } from '@/integrations/supabase/types';
import { BridgeActivityLog } from './BridgeActivityLog';

interface MaxWebBridgeFormProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  existingStatus: ConnectionStatus;
  onCollapse?: () => void;
}

type AuthStep = 'phone' | 'code' | '2fa' | 'done';

export function MaxWebBridgeForm({ config, updateConfig, existingStatus, onCollapse }: MaxWebBridgeFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<AuthStep>(existingStatus === 'connected' ? 'done' : 'phone');
  const [phone, setPhone] = useState((config.phone as string) || '');
  const [code, setCode] = useState('');
  const [password2fa, setPassword2fa] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyUrl, setProxyUrl] = useState((config.proxy as string) || '');

  // Resend countdown
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (countdown <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (countdown > 0 && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [countdown]);

  const startCountdown = () => setCountdown(60);

  /** Save session to messenger_settings and update status to connected */
  const saveSessionToDB = useCallback(async (authPayload: unknown, phoneNum: string) => {
    if (!user) return;
    const newConfig = { ...config, phone: phoneNum, auth_payload: authPayload };
    const configJson = newConfig as unknown as Json;

    // Upsert messenger_settings for max_web
    const { data: existing } = await supabase
      .from('messenger_settings')
      .select('id')
      .eq('channel', 'max_web')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('messenger_settings')
        .update({ is_active: true, status: 'connected', config: configJson })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('messenger_settings')
        .insert([{ user_id: user.id, channel: 'max_web', is_active: true, status: 'connected', config: configJson }]);
    }

    // Invalidate queries so UI picks up the new status
    queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
  }, [user, config, queryClient]);

  const handleRequestCode = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 10) {
      toast.error('Введите корректный номер телефона');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'init', phone: cleaned, ...(proxyUrl.trim() ? { proxy: proxyUrl.trim() } : {}) },
      });
      if (fnError && !data) throw fnError;
      if (!data?.success) {
        const errMsg = data?.error_code
          ? `${data.error} (${data.error_code})`
          : (data?.error || 'Не удалось запросить код');
        setError(errMsg);
        toast.error(errMsg);
        return;
      }
      updateConfig('phone', phone);
      setStep('code');
      startCountdown();
      toast.success('Запрос отправлен — ожидайте код');
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      toast.error(err?.message || 'Ошибка запроса кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    const cleaned = phone.replace(/\D/g, '');
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'verify_code', code: code.trim(), phone: cleaned },
      });
      if (fnError && !data) throw fnError;
      if (data?.needs_2fa) {
        setStep('2fa');
        toast.info('Требуется облачный пароль (2FA)');
        return;
      }
      if (!data?.success) {
        setError(data?.error || 'Неверный код');
        toast.error(data?.error || 'Ошибка: неверный код');
        return;
      }
      // Save session to DB
      updateConfig('auth_payload', data.auth_payload);
      await saveSessionToDB(data.auth_payload, cleaned);
      setStep('done');
      toast.success('Код принят — сессия успешно создана');

      // Auto-collapse after short delay
      setTimeout(() => onCollapse?.(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      toast.error(err?.message || 'Ошибка подтверждения');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit2fa = async () => {
    if (!password2fa.trim()) return;
    const cleaned = phone.replace(/\D/g, '');
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'verify_2fa', password: password2fa.trim(), phone: cleaned },
      });
      if (fnError && !data) throw fnError;
      if (!data?.success) {
        setError(data?.error || 'Неверный пароль');
        toast.error(data?.error || 'Ошибка: неверный пароль');
        return;
      }
      updateConfig('auth_payload', data.auth_payload);
      await saveSessionToDB(data.auth_payload, cleaned);
      setStep('done');
      toast.success('Сессия успешно создана');

      setTimeout(() => onCollapse?.(), 1500);
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      toast.error(err?.message || 'Ошибка 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckSession = async () => {
    setIsCheckingSession(true);
    setError(null);
    try {
      const cleaned = phone.replace(/\D/g, '');
      const { data, error: fnError } = await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'check_session', phone: cleaned },
      });
      if (fnError && !data) throw fnError;
      if (data?.active) {
        toast.success('Сессия активна');
      } else {
        toast.warning('Сессия неактивна — подключитесь заново');
        setStep('phone');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка проверки');
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setError(null);
    try {
      const cleaned = phone.replace(/\D/g, '');
      await supabase.functions.invoke('max-bridge-auth', {
        body: { action: 'logout', phone: cleaned },
      });
      updateConfig('auth_payload', null);

      // Clear session in DB
      if (user) {
        await supabase
          .from('messenger_settings')
          .update({ status: 'not_configured', is_active: false, config: { phone } as unknown as Json })
          .eq('channel', 'max_web')
          .eq('user_id', user.id);
        queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
      }

      setStep('phone');
      setCode('');
      setPassword2fa('');
      toast.info('Сессия очищена и закрыта');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка при очистке сессии');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Подключение к MAX через веб-сессию. Позволяет отправлять сообщения напрямую от вашего аккаунта без бота.
      </p>

      {step === 'phone' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="max-web-phone">Номер телефона MAX</Label>
            <div className="flex gap-2">
              <Input
                id="max-web-phone"
                placeholder="+7 (999) 123-45-67"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleRequestCode}
                disabled={isLoading || !phone.trim()}
                className="gap-2 shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                Подключить через код
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/80 mt-1">
              💡 Код может прийти не в СМС, а в само приложение MAX на другом устройстве. Проверьте системные уведомления внутри мессенджера.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-web-proxy" className="text-xs">Прокси (опционально)</Label>
            <Input
              id="max-web-proxy"
              placeholder="socks5://user:pass@host:port"
              value={proxyUrl}
              onChange={e => setProxyUrl(e.target.value)}
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground/70">Если код не приходит, введите прокси для запроса из вашего региона</p>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="max-web-code">Код подтверждения</Label>
            <p className="text-xs text-muted-foreground">Введите код из СМС или приложения MAX</p>
            <div className="flex gap-2">
              <Input
                id="max-web-code"
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value)}
                maxLength={8}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleSubmitCode}
                disabled={isLoading || !code.trim()}
                className="gap-2 shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Подтвердить
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep('phone')}>
              ← Другой номер
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRequestCode}
              disabled={isLoading || countdown > 0}
            >
              {countdown > 0 ? `Повторить через ${countdown} сек` : 'Отправить код снова'}
            </Button>
          </div>
        </div>
      )}

      {step === '2fa' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="max-web-2fa">Облачный пароль (2FA)</Label>
            <p className="text-xs text-muted-foreground">В вашем аккаунте MAX включена двухфакторная аутентификация</p>
            <div className="flex gap-2">
              <Input
                id="max-web-2fa"
                type="password"
                placeholder="Введите пароль"
                value={password2fa}
                onChange={e => setPassword2fa(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleSubmit2fa}
                disabled={isLoading || !password2fa.trim()}
                className="gap-2 shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Войти
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Веб-сессия активна</span>
            {phone && <span className="text-muted-foreground">({phone})</span>}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckSession}
              disabled={isCheckingSession}
              className="gap-2"
            >
              {isCheckingSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              Проверить статус сессии
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="gap-2 text-destructive hover:text-destructive"
            >
              {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Очистить сессию
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {step === 'done' && <BridgeActivityLog channel="max_web" />}
    </div>
  );
}
