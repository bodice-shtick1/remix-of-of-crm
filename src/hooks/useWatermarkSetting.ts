import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useWatermarkSetting() {
  const queryClient = useQueryClient();

  const { data: enabled = false, isLoading } = useQuery({
    queryKey: ['watermark_setting'],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_settings')
        .select('enable_watermarks')
        .maybeSingle();
      return (data as any)?.enable_watermarks ?? false;
    },
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from('organization_settings')
        .update({ enable_watermarks: value } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watermark_setting'] });
    },
  });

  return { enabled, isLoading, toggle };
}
