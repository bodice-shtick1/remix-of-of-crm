import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { MainLayout } from './MainLayout';
import SetupWizard from '@/pages/SetupWizard';
import { ForcePasswordChange } from '@/components/auth/ForcePasswordChange';

/** Map route paths to the permission key(s) required to view them.
 *  A string means a single required key; an array means OR logic (any one grants access). */
const DASHBOARD_PERMISSIONS = ['dash_stats_view', 'dash_debts_view', 'dash_income_view', 'dash_expiring_view', 'dash_events_view', 'dash_actions_access', 'dash_shift_manage'];

const ROUTE_PERMISSION_MAP: Record<string, string | string[]> = {
  '/': DASHBOARD_PERMISSIONS,
  '/clients': 'clients_view',
  '/sales': 'sale_process',
  '/sales-history': 'sale_process',
  '/catalog': ['cat_products_view', 'cat_services_view', 'cat_companies_view', 'cat_cars_view', 'cat_registry_view'],
  '/policies': 'policies_view',
  '/finances': 'finances_view',
  '/notifications': ['notify_queue_view', 'notify_templates_manage', 'notify_manual_send', 'notify_automation_config', 'notify_mass_bulk'],
  '/communication': 'comm_center_view',
  '/reports': 'reports_cash_view',
  '/shift-reports': 'reports_shifts_view',
  '/prolongation-report': 'reports_prolongation_view',
  '/europrotocol': 'europrotocol_view',
  '/analytics': 'analytics_view',
  '/team': 'team_manage',
  '/event-log': 'event_log_view',
  '/settings': ['settings_edit', 'settings_profile_view', 'settings_sales_view', 'settings_company_view', 'settings_notifications_view', 'settings_channels_view', 'settings_security_view'],
  '/settings/permissions': 'settings_matrix_view',
  '/messenger-settings': 'settings_channels_view',
  '/access-logs': 'security_audit_view',
};

interface ProtectedRouteProps {
  children?: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, userRole, isLoading } = useAuth();
  const { needsSetup, isLoading: orgLoading } = useOrganization();
  const { can, isLoading: permLoading } = usePermissions();
  const location = useLocation();
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [checkingPassword, setCheckingPassword] = useState(true);

  useEffect(() => {
    async function checkPasswordChange() {
      if (!user) {
        setCheckingPassword(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('must_change_password')
        .eq('user_id', user.id)
        .maybeSingle();

      setMustChangePassword(profile?.must_change_password ?? false);
      setCheckingPassword(false);
    }

    checkPasswordChange();
  }, [user]);

  if (isLoading || orgLoading || checkingPassword || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show setup wizard BEFORE auth check — no login needed for first launch
  if (needsSetup) {
    return <SetupWizard />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Force password change for operators with temporary passwords
  if (mustChangePassword) {
    return <ForcePasswordChange onSuccess={() => setMustChangePassword(false)} />;
  }

  // Admin-only routes redirect operators to dashboard
  if (adminOnly && userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Route-level permission check: deny access if user lacks the required permission
  const requiredPermission = ROUTE_PERMISSION_MAP[location.pathname];
  if (requiredPermission) {
    const allowed = Array.isArray(requiredPermission)
      ? requiredPermission.some(k => can(k))
      : can(requiredPermission);
    if (!allowed) {
      return <Navigate to="/" replace />;
    }
  }

  return <MainLayout />;
}
