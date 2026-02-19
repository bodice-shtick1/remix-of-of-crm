import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logEventDirect } from '@/hooks/useEventLog';

interface CleanupDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CleanupDatabaseDialog({ open, onOpenChange }: CleanupDatabaseDialogProps) {
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleClose = useCallback(() => {
    setPassword('');
    setError('');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCleanup = useCallback(async () => {
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Verify admin password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Пользователь не найден');

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authErr) {
        setError('Неверный пароль');
        setIsProcessing(false);
        return;
      }

      // Delete in order: debt_payments -> sale_items -> sale_audit_log -> policies -> sales -> vehicle_registry -> clients
      // We need to respect foreign key constraints
      const tables = [
        { name: 'debt_payments', label: 'Платежи по долгам' },
        { name: 'sale_audit_log', label: 'Аудит продаж' },
        { name: 'sale_items', label: 'Позиции продаж' },
        { name: 'client_documents', label: 'Документы клиентов' },
        { name: 'client_interactions', label: 'Заметки клиентов' },
        { name: 'notification_logs', label: 'Логи уведомлений' },
        { name: 'messages', label: 'Сообщения' },
        { name: 'access_logs', label: 'Логи доступа' },
        { name: 'payments', label: 'Платежи' },
        { name: 'tasks', label: 'Задачи' },
        { name: 'policies', label: 'Полисы' },
        { name: 'sales', label: 'Продажи' },
        { name: 'vehicle_registry', label: 'Реестр ТС' },
        { name: 'pinned_conversations', label: 'Закрепленные чаты' },
        { name: 'clients', label: 'Клиенты' },
      ] as const;

      let deleted = 0;
      for (const table of tables) {
        const { error: delErr } = await supabase
          .from(table.name)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
        if (delErr) {
          console.warn(`Cleanup: ${table.name} — ${delErr.message}`);
        } else {
          deleted++;
        }
      }

      logEventDirect({
        action: 'cleanup',
        category: 'service',
        fieldAccessed: 'Очистка базы данных',
        details: { tables_processed: deleted, tables_total: tables.length },
      });

      toast.success(`База очищена`, {
        description: `Обработано таблиц: ${deleted}/${tables.length}`,
      });
      handleClose();
    } catch (e: any) {
      setError(e?.message || 'Ошибка очистки');
    } finally {
      setIsProcessing(false);
    }
  }, [password, handleClose]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Удаление всех данных
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Это действие полностью очистит таблицы: <strong>клиенты, продажи, полисы, платежи, реестр ТС</strong> и связанные данные.
            </span>
            <span className="block text-destructive font-medium">
              Данные невозможно будет восстановить. Используйте только после тестового импорта.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cleanup-password">Введите ваш пароль для подтверждения</Label>
            <Input
              id="cleanup-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Пароль администратора"
              disabled={isProcessing}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCleanup(); }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Отмена</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleCleanup}
            disabled={isProcessing || !password.trim()}
            className="gap-1"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isProcessing ? 'Очистка…' : 'Удалить все данные'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
