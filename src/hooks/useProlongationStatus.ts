import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

export type ProlongationStatus = 'pending' | 'prolonged' | 'lost' | 'irrelevant';

export const prolongationStatusLabels: Record<ProlongationStatus, string> = {
  pending: 'Ожидает',
  prolonged: 'Пролонгирован',
  lost: 'Утрачен',
  irrelevant: 'Неактуально',
};

export const prolongationStatusColors: Record<ProlongationStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-warning/10', text: 'text-warning' },
  prolonged: { bg: 'bg-success/10', text: 'text-success' },
  lost: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  irrelevant: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

export function useProlongationStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ policyId, status }: { policyId: string; status: ProlongationStatus }) => {
      const { error } = await supabase
        .from('policies')
        .update({ prolongation_status: status })
        .eq('id', policyId);
      
      if (error) throw error;
      return { policyId, status };
    },
    onSuccess: ({ policyId, status }) => {
      toast({
        title: 'Статус обновлён',
        description: `Установлен статус: ${prolongationStatusLabels[status]}`,
      });
      logEventDirect({ action: 'update', category: 'sales', entityType: 'policy', entityId: policyId, fieldAccessed: 'Статус пролонгации', newValue: prolongationStatusLabels[status] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => {
      console.error('Error updating prolongation status:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
        variant: 'destructive',
      });
    },
  });

  return {
    updateStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
}
