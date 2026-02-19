import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, QrCode, AlertTriangle, CheckCircle2, Terminal, Bug } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';

const INIT_TIMEOUT = 60000;
const POLL_INTERVAL = 2000;
const FORCE_RESTART_AFTER = 15000;
const QR_REFRESH_INTERVAL = 25;
const MAX_RETRIES = 3;
const FAKE_QR = '2@DEBUG_TEST_QR_1234567890,ABCDEF,simulated-session';

interface WhatsAppQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogState = 'initializing' | 'waiting_qr' | 'qr_ready' | 'syncing' | 'error';
interface LogEntry { time: string; message: string; level: 'info' | 'error' | 'success' }

const STATUS_MESSAGES: Record<string, string> = {
  init: 'Связь с WhatsApp установлена. Формируем безопасный канал…',
  waiting: 'Генерация QR-кода. Это может занять до 30 секунд…',
  restart: 'Перезапуск сессии на сервере…',
  polling: 'Ожидание ответа от сервера…',
};

function ts() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function WhatsAppQrDialog({ open, onOpenChange }: WhatsAppQrDialogProps) {
  const [state, setState] = useState<DialogState>('initializing');
  const [statusText, setStatusText] = useState(STATUS_MESSAGES.init);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(QR_REFRESH_INTERVAL);
  const [retryCount, setRetryCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    console.log(`[WhatsApp QR] [${level.toUpperCase()}] ${message}`);
    setLogs(prev => [...prev.slice(-29), { time: ts(), message, level }]);
  }, []);

  const clearTimers = useCallback(() => {
    [pollRef, countdownRef, forceRef].forEach(r => {
      if (r.current) { clearInterval(r.current as any); clearTimeout(r.current as any); r.current = null; }
    });
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(QR_REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => setCountdown(p => (p <= 1 ? QR_REFRESH_INTERVAL : p - 1)), 1000);
  }, []);

  const handleQrReceived = useCallback((value: string) => {
    setQrValue(value);
    setState('qr_ready');
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (forceRef.current) { clearTimeout(forceRef.current); forceRef.current = null; }
    startCountdown();
  }, [startCountdown]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    addLog(`Polling запущен (каждые ${POLL_INTERVAL / 1000} сек)`);
    setStatusText(STATUS_MESSAGES.polling);

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('whatsapp-bridge', { body: { action: 'check_session' } });
        if (data?.active) { addLog('Сессия active!', 'success'); clearTimers(); setState('syncing'); return; }
        if (data?.qr_value) { addLog(`qr_value: ${String(data.qr_value).substring(0, 25)}…`, 'success'); handleQrReceived(data.qr_value); }
      } catch { /* retry */ }
    }, POLL_INTERVAL);
  }, [addLog, clearTimers, handleQrReceived]);

  const sendForceRestart = useCallback(async () => {
    addLog('15 сек без QR — принудительный restart_session');
    setStatusText(STATUS_MESSAGES.restart);
    try {
      const { data } = await supabase.functions.invoke('whatsapp-bridge', { body: { action: 'restart_session' } });
      addLog(`restart_session → ${data?.success ? 'OK' : data?.error || 'fail'}`, data?.success ? 'success' : 'error');
      if (data?.qr_value) handleQrReceived(data.qr_value);
    } catch (e: any) {
      addLog(`restart_session error: ${e?.message}`, 'error');
    }
  }, [addLog, handleQrReceived]);

  // ── main init ──
  const initSession = useCallback(async (isRetry = false) => {
    clearTimers();
    setState('initializing');
    setQrValue(null);
    setError(null);
    setStatusText(STATUS_MESSAGES.init);
    if (!isRetry) setLogs([]);

    if (debugMode) {
      addLog('⚙ Имитация QR', 'success');
      handleQrReceived(FAKE_QR);
      return;
    }

    addLog('invoke("whatsapp-bridge", { action: "generate_qr" })');

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), INIT_TIMEOUT);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('whatsapp-bridge', {
        body: { action: 'generate_qr' },
      });

      clearTimeout(timer);
      if (controller.signal.aborted) {
        addLog('Таймаут 60 сек', 'error');
        setError('Сервер не ответил за 60 секунд.');
        setState('error');
        return;
      }

      if (fnError) {
        console.error('[WhatsApp QR] fnError:', fnError);
        addLog(`fnError: ${fnError.message || JSON.stringify(fnError)}`, 'error');
        if (!data) { setError('Edge Function whatsapp-bridge не найдена. Выполните деплой.'); setState('error'); return; }
      }

      if (!data?.success) {
        addLog(`Ошибка: ${data?.error}`, 'error');
        setError(data?.error || 'Ошибка инициализации');
        setState('error');
        return;
      }

      addLog(`Сессия создана, token=${String(data.session_token).substring(0, 8)}…`, 'success');
      setStatusText(STATUS_MESSAGES.waiting);

      if (data.qr_value) {
        addLog('QR получен сразу!', 'success');
        handleQrReceived(data.qr_value);
      } else {
        setState('waiting_qr');
        startPolling();
        // Force restart after 15s if still no QR
        forceRef.current = setTimeout(sendForceRestart, FORCE_RESTART_AFTER);
      }

      if (isRetry) setRetryCount(p => p + 1);

    } catch (err: any) {
      clearTimeout(timer);
      console.error('[WhatsApp QR] catch:', err);
      addLog(`Исключение: ${err?.message}`, 'error');
      setError('Edge Function не задеплоена. Выполните: supabase functions deploy whatsapp-bridge');
      setState('error');
    }
  }, [clearTimers, addLog, startPolling, handleQrReceived, sendForceRestart, debugMode]);

  // Realtime
  useEffect(() => {
    if (!open) return;
    const ch = supabase.channel('qr-rt').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messenger_settings' }, (payload) => {
      const row = payload.new as any;
      if (row.channel !== 'whatsapp_web') return;
      if (row.status === 'connected') { addLog('Realtime → connected', 'success'); clearTimers(); setState('syncing'); return; }
      const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      if (cfg?.qr_value) { addLog('Realtime → qr_value', 'success'); handleQrReceived(cfg.qr_value); }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, addLog, clearTimers, handleQrReceived]);

  useEffect(() => {
    if (open) { setRetryCount(0); initSession(); }
    else { clearTimers(); setState('initializing'); setQrValue(null); setError(null); setLogs([]); }
    return clearTimers;
  }, [open, initSession, clearTimers]);

  // Auto-refresh QR
  useEffect(() => {
    if (state !== 'qr_ready' || debugMode) return;
    const h = setTimeout(() => { addLog('QR истёк'); initSession(true); }, QR_REFRESH_INTERVAL * 1000);
    return () => clearTimeout(h);
  }, [state, qrValue, initSession, addLog, debugMode]);

  const progress = ((QR_REFRESH_INTERVAL - countdown) / QR_REFRESH_INTERVAL) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-green-600" />
            Подключение WhatsApp Web
          </DialogTitle>
          <DialogDescription>
            WhatsApp → Настройки → Связанные устройства → Привязка устройства
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {(state === 'initializing' || state === 'waiting_qr') && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="relative w-[280px] h-[280px] rounded-xl bg-muted animate-pulse">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-[260px]">{statusText}</p>
            </div>
          )}

          {state === 'qr_ready' && qrValue && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-5 bg-white rounded-xl shadow-sm border">
                <QRCodeSVG value={qrValue} size={250} level="M" bgColor="#ffffff" fgColor="#000000" />
              </div>
              {!debugMode && (
                <div className="w-full max-w-[280px] space-y-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground text-center">Обновление через <span className="font-medium tabular-nums">{countdown}</span> сек</p>
                </div>
              )}
              {debugMode && <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">⚙ Имитация</p>}
              {retryCount >= MAX_RETRIES && (
                <Button variant="outline" size="sm" onClick={() => { setRetryCount(0); initSession(); }} className="gap-2 w-full">
                  <RefreshCw className="h-3.5 w-3.5" /> Перегенерировать
                </Button>
              )}
            </div>
          )}

          {state === 'syncing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 animate-pulse" />
              <p className="text-sm font-medium">Синхронизация данных…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-[280px] rounded-xl border-2 border-dashed border-destructive/30 p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          )}

          {state !== 'syncing' && (
            <Button variant="outline" size="sm" onClick={() => { setRetryCount(0); initSession(); }} disabled={state === 'initializing'} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Попробовать ещё раз
            </Button>
          )}

          <div className="w-full space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setShowLogs(p => !p)} className="gap-2 text-xs text-muted-foreground h-7 px-2">
                <Terminal className="h-3 w-3" /> {showLogs ? 'Скрыть' : 'Лог'}
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={debugMode} onCheckedChange={v => setDebugMode(!!v)} className="h-3.5 w-3.5" />
                <Bug className="h-3 w-3" /> Имитация
              </label>
            </div>
            {showLogs && (
              <div className="rounded-lg border bg-muted/50 p-2 max-h-36 overflow-y-auto text-[10px] font-mono space-y-0.5">
                {logs.length === 0 && <p className="text-muted-foreground">—</p>}
                {logs.map((l, i) => (
                  <div key={i} className={l.level === 'error' ? 'text-destructive' : l.level === 'success' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                    <span className="opacity-60">{l.time}</span> {l.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
