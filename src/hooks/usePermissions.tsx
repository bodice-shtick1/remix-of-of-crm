import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PermissionsContextType {
  can: (permissionKey: string) => boolean;
  permissions: Record<string, boolean>;
  isLoading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, userRole, customRoleName } = useAuth();

  // The effective role used for permission lookups:
  // custom_role_name from profile takes priority, then falls back to user_roles.role
  const effectiveRole = customRoleName || userRole;

  const { data: rawPermissions, isLoading } = useQuery({
    queryKey: ['role_permissions', effectiveRole],
    queryFn: async () => {
      if (!effectiveRole) return [];
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_key, is_enabled')
        .eq('role', effectiveRole);
      if (error) {
        console.error('[Permissions] Error fetching:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!user && !!effectiveRole,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
  });

  const permissions = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (rawPermissions) {
      for (const p of rawPermissions) {
        map[p.permission_key] = p.is_enabled;
      }
    }
    return map;
  }, [rawPermissions]);

  const can = useCallback((permissionKey: string): boolean => {
    // Super Admin Override: admin always has full access
    if (effectiveRole === 'admin') return true;
    return permissions[permissionKey] ?? false;
  }, [permissions, effectiveRole]);

  return (
    <PermissionsContext.Provider value={{ can, permissions, isLoading }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
