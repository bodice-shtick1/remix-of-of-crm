import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProlongationStatus } from '@/hooks/useProlongationStatus';

interface ExpiringPolicyForClient {
  id: string;
  policy_type: string;
  policy_number: string;
  end_date: string;
  premium_amount: number;
  vehicle_number: string | null;
  prolongation_status: ProlongationStatus;
}

/**
 * Hook to fetch expiring policies for a specific client
 * Only returns policies with 'pending' status that are expiring within 30 days
 */
export function useClientExpiringPolicies(clientId: string | null) {
  const { data: expiringPolicies = [], isLoading } = useQuery({
    queryKey: ['client-expiring-policies', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      const thirtyDaysLaterStr = thirtyDaysLater.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('policies')
        .select('id, policy_type, policy_number, end_date, premium_amount, vehicle_number, prolongation_status')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .eq('prolongation_status', 'pending') // Only show pending status
        .gte('end_date', todayStr)
        .lte('end_date', thirtyDaysLaterStr)
        .order('end_date', { ascending: true });

      if (error) {
        console.error('Error fetching client expiring policies:', error);
        return [];
      }

      return (data || []) as ExpiringPolicyForClient[];
    },
    enabled: !!clientId,
  });

  return {
    expiringPolicies,
    hasExpiringPolicies: expiringPolicies.length > 0,
    isLoading,
  };
}
