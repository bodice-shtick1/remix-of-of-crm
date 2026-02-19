import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, ScrollText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

type Period = 'all' | '1month' | '3months' | '6months';

const periodLabels: Record<Period, string> = {
  all: 'Все записи',
  '1month': 'Старше 1 месяца',
  '3months': 'Старше 3 месяцев',
  '6months': 'Старше 6 месяцев',
};

export function CleanupEventLogDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>('6months');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCleanup = async () => {
    if (!user || confirmText !== 'УДАЛИТЬ') return;

    setIsDeleting(true);
    try {
      // Count before delete
      let query = supabase.from('access_logs').select('id', { count: 'exact', head: true });
      if (period !== 'all') {
        const months = period === '1month' ? 1 : period === '3months' ? 3 : 6;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        query = query.lt('created_at', cutoff.toISOString());
      }
      const { count: totalToDelete } = await query;

      // Perform delete
      let deleteQuery = supabase.from('access_logs').delete();
      if (period !== 'all') {
        const months = period === '1month' ? 1 : period === '3months' ? 3 : 6;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        deleteQuery = deleteQuery.lt('created_at', cutoff.toISOString());
      } else {
        // Delete all — need a condition that matches everything
        deleteQuery = deleteQuery.gte('created_at', '1970-01-01T00:00:00Z');
      }

      const { error } = await deleteQuery;
      if (error) throw error;

      // Log the cleanup action itself
      await logEventDirect({
        action: 'cleanup',
        category: 'service',
        entityType: 'access_logs',
        details: {
          period: periodLabels[period],
          deleted_count: totalToDelete || 0,
          description: `Произведена очистка журнала событий за период: ${periodLabels[period]}`,
        },
      });

      toast({
        title: 'Журнал успешно очищен',
        description: `Удалено ${totalToDelete || 0} записей`,
      });

      setDialogOpen(false);
      setConfirmText('');
    } catch (error) {
      console.error('Cleanup error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить журнал событий',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <ScrollText className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Очистка Журнала событий</h3>
            <p className="text-xs text-muted-foreground">
              Удаление записей аудита за выбранный период
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Удалить всё</SelectItem>
              <SelectItem value="1month">Старше 1 месяца</SelectItem>
              <SelectItem value="3months">Старше 3 месяцев</SelectItem>
              <SelectItem value="6months">Старше 6 месяцев</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            onClick={() => setDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Очистить журнал
          </Button>
        </div>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистка Журнала событий</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Это действие необратимо. Вы уверены, что хотите удалить{' '}
                <span className="font-semibold text-foreground">
                  {periodLabels[period].toLowerCase()}
                </span>{' '}
                записей из журнала событий?
              </p>
              <p className="text-xs">
                Для подтверждения введите слово <span className="font-mono font-bold text-destructive">УДАЛИТЬ</span> в поле ниже:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Введите УДАЛИТЬ"
                className="font-mono"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== 'УДАЛИТЬ' || isDeleting}
              onClick={handleCleanup}
            >
              {isDeleting ? 'Удаление...' : 'Подтвердить очистку'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
