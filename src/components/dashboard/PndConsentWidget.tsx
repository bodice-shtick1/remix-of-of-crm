import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function PndConsentWidget() {
  const navigate = useNavigate();

  const { data: unsignedCount, isLoading } = useQuery({
    queryKey: ['pnd-unsigned-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_pnd_signed', false)
        .eq('is_archived', false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton className="h-[72px] rounded-lg" />;

  const hasUnsigned = (unsignedCount ?? 0) > 0;

  return (
    <div
      onClick={() => navigate('/clients?filter=pnd_unsigned')}
      className={`rounded-lg border px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors hover:opacity-80 ${
        hasUnsigned
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-success/30 bg-success/5'
      }`}
    >
      <div className={`p-1.5 rounded-md ${hasUnsigned ? 'bg-destructive/10' : 'bg-success/10'}`}>
        {hasUnsigned
          ? <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
          : <ShieldCheck className="h-3.5 w-3.5 text-success" />}
      </div>
      <div className="min-w-0">
        <p className={`text-lg font-bold leading-none ${hasUnsigned ? 'text-destructive' : 'text-success'}`}>
          {unsignedCount}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {hasUnsigned ? 'без согласия ПДН' : 'все согласия ПДН'}
        </p>
      </div>
    </div>
  );
}
