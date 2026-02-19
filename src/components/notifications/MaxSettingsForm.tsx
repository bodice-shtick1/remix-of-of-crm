import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MaxSettingsFormProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}

export function MaxSettingsForm({ config, updateConfig }: MaxSettingsFormProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [botName, setBotName] = useState<string | null>(null);

  const handleTestConnection = async () => {
    const token = (config.bot_token as string) || '';
    if (!token || token.length < 10) {
      toast.error('Введите токен бота MAX');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setBotName(null);

    try {
      // Call MAX Bot API /me endpoint to verify token
      const response = await fetch(`https://platform-api.max.ru/me`, {
        method: 'GET',
        headers: { 'Authorization': token },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult('success');
        setBotName(data.name || data.username || 'MAX Bot');
        toast.success(`Подключение успешно! Бот: ${data.name || data.username || 'OK'}`);
      } else {
        setTestResult('error');
        toast.error(`Ошибка подключения: ${response.status}`);
      }
    } catch (err) {
      setTestResult('error');
      toast.error(`Ошибка: ${(err as Error).message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSetupWebhook = async () => {
    const token = (config.bot_token as string) || '';
    if (!token) {
      toast.error('Сначала введите токен бота');
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const webhookUrl = `${supabaseUrl}/functions/v1/max-webhook`;

    try {
      const response = await fetch(`https://platform-api.max.ru/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          update_types: ['message_created', 'message_callback'],
        }),
      });

      if (response.ok) {
        updateConfig('webhook_url', webhookUrl);
        toast.success('Вебхук настроен успешно');
      } else {
        const errText = await response.text();
        toast.error(`Ошибка настройки вебхука: ${errText}`);
      }
    } catch (err) {
      toast.error(`Ошибка: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="max-bot-token">Токен бота MAX</Label>
        <p className="text-xs text-muted-foreground">
          Получите токен у @MasterBot в мессенджере MAX
        </p>
        <Input
          id="max-bot-token"
          type="password"
          placeholder="Вставьте токен бота"
          value={(config.bot_token as string) || ''}
          onChange={e => updateConfig('bot_token', e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting || !(config.bot_token as string)?.trim()}
          className="gap-2"
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : testResult === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : testResult === 'error' ? (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Wifi className="h-3.5 w-3.5" />
          )}
          Проверить соединение
        </Button>

        {botName && (
          <span className="text-xs text-green-600 font-medium">✓ {botName}</span>
        )}
      </div>

      <div className="space-y-2">
        <Label>Вебхук для входящих сообщений</Label>
        <p className="text-xs text-muted-foreground">
          Настройте автоматический приём сообщений от клиентов
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSetupWebhook}
          disabled={!(config.bot_token as string)?.trim()}
          className="gap-2"
        >
          <Wifi className="h-3.5 w-3.5" />
          Настроить вебхук
        </Button>
        {(config.webhook_url as string) && (
          <p className="text-xs text-muted-foreground break-all">
            URL: {config.webhook_url as string}
          </p>
        )}
      </div>
    </div>
  );
}
