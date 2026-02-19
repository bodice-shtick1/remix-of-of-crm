import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TelegramAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiId: string;
  apiHash: string;
  phone: string;
  onAuthorized: (sessionString: string) => void;
}

type AuthStep = 'send_code' | 'verify_code' | '2fa';

function sanitizePhone(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

export function TelegramAuthDialog({
  open,
  onOpenChange,
  apiId,
  apiHash,
  phone,
  onAuthorized,
}: TelegramAuthDialogProps) {
  const [step, setStep] = useState<AuthStep>('send_code');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [tempSession, setTempSession] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'send_code',
          api_id: apiId,
          api_hash: apiHash,
          phone: sanitizePhone(phone),
        },
      });

      if (error) {
        if (error.message?.includes('404') || error.message?.includes('Failed to fetch')) {
          toast.error("Edge Function 'telegram-auth' не найдена. Требуется деплой серверной части.");
          return;
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      if (data?.status === 'code_requested') {
        setPhoneCodeHash(data.phone_code_hash);
        setTempSession(data.session_string);
        setStep('verify_code');
        toast.info('Код отправлен в Telegram');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка отправки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!code || code.length < 4) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'sign_in',
          api_id: apiId,
          api_hash: apiHash,
          phone: sanitizePhone(phone),
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
        toast.info('Требуется облачный пароль (2FA)');
        return;
      }

      if (data?.status === 'authorized') {
        toast.success('Telegram авторизован успешно!');
        onAuthorized(data.session_string);
        resetState();
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка верификации');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn2FA = async () => {
    if (!password) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-auth', {
        body: {
          action: 'sign_in_2fa',
          api_id: apiId,
          api_hash: apiHash,
          session_string: tempSession,
          password,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.status === 'authorized') {
        toast.success('Telegram авторизован успешно!');
        onAuthorized(data.session_string);
        resetState();
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setStep('send_code');
    setCode('');
    setPassword('');
    setPhoneCodeHash('');
    setTempSession('');
  };

  const handleClose = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Авторизация Telegram
          </DialogTitle>
          <DialogDescription>
            {step === 'send_code' && `Мы отправим код подтверждения на ${phone} через Telegram`}
            {step === 'verify_code' && 'Введите код, полученный в Telegram'}
            {step === '2fa' && 'Введите облачный пароль двухфакторной аутентификации'}
          </DialogDescription>
        </DialogHeader>

        {step === 'send_code' && (
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <p>API ID: <span className="font-mono">{apiId}</span></p>
              <p>Телефон: <span className="font-mono">{sanitizePhone(phone)}</span></p>
            </div>
            <Button onClick={handleSendCode} disabled={isLoading} className="w-full gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Запрос кода...
                </>
              ) : (
                'Отправить код'
              )}
            </Button>
          </div>
        )}

        {step === 'verify_code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tg-auth-code">Код подтверждения</Label>
              <Input
                id="tg-auth-code"
                placeholder="12345"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                autoFocus
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Убедитесь, что вы ввели номер в международном формате +7... и ваше приложение Telegram открыто.
              </p>
            </div>

            <Button
              onClick={handleSignIn}
              disabled={isLoading || code.length < 4}
              className="w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Проверка...
                </>
              ) : (
                'Подтвердить'
              )}
            </Button>
          </div>
        )}

        {step === '2fa' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tg-2fa-password">Облачный пароль (2FA)</Label>
              <Input
                id="tg-2fa-password"
                type="password"
                placeholder="Введите облачный пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <KeyRound className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Это пароль, который вы установили в настройках Telegram → Конфиденциальность → Двухэтапная аутентификация.
              </p>
            </div>

            <Button
              onClick={handleSignIn2FA}
              disabled={isLoading || !password}
              className="w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Проверка 2FA...
                </>
              ) : (
                'Подтвердить'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
