import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OrganizationSettings {
  id: string;
  name: string;
  inn: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  is_setup_complete: boolean;
  created_by: string;
}

export function useOrganization() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: org, isLoading: orgLoading, isFetched } = useQuery({
    queryKey: ['organization_settings'],
    queryFn: async () => {
      console.log('[Org] Fetching organization settings...');
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .maybeSingle();
      if (error) {
        console.error('[Org] Error fetching settings:', error.message);
        throw error;
      }
      console.log('[Org] Organization found:', !!data);
      return data as OrganizationSettings | null;
    },
    // Don't fetch until auth is done loading to prevent race conditions
    enabled: !authLoading,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Only show loading during initial auth check OR while org query hasn't completed yet
  const isLoading = authLoading || (!isFetched && !authLoading);

  const setupOrg = useMutation({
    mutationFn: async (values: { name: string; inn?: string; address?: string; currency?: string; timezone?: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Use SECURITY DEFINER RPC to bypass RLS for first setup
      const { error } = await supabase.rpc('bootstrap_first_admin', {
        _user_id: user.id,
        _full_name: user.user_metadata?.full_name || user.email || 'Admin',
        _org_name: values.name,
        _org_inn: values.inn || null,
        _org_address: values.address || null,
        _org_currency: values.currency || '₽',
        _org_timezone: values.timezone || 'Europe/Moscow',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization_settings'] });
    },
  });

  const needsSetup = !isLoading && !org;
  const isSetupComplete = !!org?.is_setup_complete;

  return { org, isLoading, needsSetup, isSetupComplete, setupOrg };
}
