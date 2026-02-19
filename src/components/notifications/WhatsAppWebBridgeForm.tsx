import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Wifi, LogOut, QrCode, Smartphone, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { ConnectionStatus } from '@/hooks/useMessengerSettings';
import type { Json } from '@/integrations/supabase/types';
import { WhatsAppQrDialog } from './WhatsAppQrDialog';
import { WhatsAppSetupInstructions } from './WhatsAppSetupInstructions';
import { BridgeActivityLog } from './BridgeActivityLog';

interface WhatsAppWebBridgeFormProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
  existingStatus: ConnectionStatus;
  onCollapse?: () => void;
}

export function WhatsAppWebBridgeForm({ config, updateConfig, existingStatus, onCollapse }: WhatsAppWebBridgeFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(existingStatus === 'connected');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  const profileName = (config.profile_name as string) || '';
  const profilePicUrl = (config.profile_pic as string) || '';

  // Realtime subscription: watch messenger_settings for whatsapp_web connected status
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('whatsapp-web-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messenger_settings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.channel === 'whatsapp_web' && row.status === 'connected') {
            setIsConnected(true);
            setQrDialogOpen(false);
            toast.success('WhatsApp успешно подключен!');
            queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });

            if (row.config) {
              const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
              if (cfg.profile_name) updateConfig('profile_name', cfg.profile_name);
              if (cfg.profile_pic) updateConfig('profile_pic', cfg.profile_pic);
            }

            setTimeout(() => onCollapse?.(), 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, updateConfig, onCollapse]);

  useEffect(() => {
    setIsConnected(existingStatus === 'connected');
  }, [existingStatus]);

  const handleCheckSession = async () => {
    setIsCheckingSession(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-bridge', {
        body: { action: 'check_session' },
      });
      if (error && !data) throw error;
      if (data?.active) {
        toast.success('Сессия WhatsApp активна');
      } else {
        toast.warning('Сессия неактивна — подключитесь заново');
        setIsConnected(false);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка проверки');
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.functions.invoke('whatsapp-bridge', {
        body: { action: 'logout' },
      });

      if (user) {
        await supabase
          .from('messenger_settings')
          .update({
            status: 'not_configured',
            is_active: false,
            config: {} as unknown as Json,
          })
          .eq('channel', 'whatsapp_web')
          .eq('user_id', user.id);
        queryClient.invalidateQueries({ queryKey: ['messenger-settings'] });
      }

      updateConfig('auth_payload', null);
      updateConfig('profile_name', null);
      updateConfig('profile_pic', null);
      setIsConnected(false);
      toast.info('Сессия WhatsApp завершена');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка при отключении');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Подключение к WhatsApp через сканирование QR-кода. Позволяет писать первым, отправлять медиа и синхронизировать историю.
      </p>

      {!isConnected ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => setQrDialogOpen(true)}
              className="gap-2"
              variant="outline"
            >
              <QrCode className="h-4 w-4" />
              Сгенерировать QR-код
            </Button>
            <Button
              type="button"
              onClick={() => setInstructionsOpen(true)}
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
            >
              <BookOpen className="h-4 w-4" />
              Инструкция по запуску
            </Button>
          </div>

          <WhatsAppQrDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen} />
          <WhatsAppSetupInstructions open={instructionsOpen} onOpenChange={setInstructionsOpen} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {profilePicUrl && (
              <img
                src={profilePicUrl}
                alt="WhatsApp avatar"
                className="h-10 w-10 rounded-full object-cover border"
              />
            )}
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Активен (WhatsApp Web)</span>
              {profileName && <span className="text-muted-foreground">— {profileName}</span>}
            </div>
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
              Проверить статус
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
              Разорвать соединение
            </Button>
          </div>
        </div>
      )}

      {isConnected && <BridgeActivityLog channel="whatsapp_web" />}
    </div>
  );
}
