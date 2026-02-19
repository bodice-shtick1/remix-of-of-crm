import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditConfigRule {
  id: string;
  rule_type: 'role_rule' | 'blacklist' | 'access_rule' | 'rate_limit';
  target_role: string | null;
  target_user_id: string | null;
  action_type: string;
  is_enabled: boolean;
  config_value?: number | null;
  restriction_bypass_until?: string | null;
}

const ACTION_TYPES = ['login', 'create', 'update', 'delete', 'view_contact', 'print', 'screenshot_logging', 'tab_switch_logging'] as const;
export type AuditActionType = typeof ACTION_TYPES[number];
export { ACTION_TYPES };

const ACTION_LABELS: Record<string, string> = {
  login: 'Вход',
  create: 'Создание',
  update: 'Редактирование',
  delete: 'Удаление',
  view_contact: 'Просмотр телефона',
  print: 'Печать',
  screenshot_logging: 'Скриншоты',
  tab_switch_logging: 'Вкладки / Фокус',
};
export { ACTION_LABELS };

export function useAuditLogConfig() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['audit-log-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log_config')
        .select('*')
        .order('created_at');
      if (error) throw error;
      return data as AuditConfigRule[];
    },
  });

  const roleRules = rules.filter(r => r.rule_type === 'role_rule');
  const blacklistRules = rules.filter(r => r.rule_type === 'blacklist');
  const accessRules = rules.filter(r => (r.rule_type as string) === 'access_rule');
  const rateLimitRules = rules.filter(r => (r.rule_type as string) === 'rate_limit');
  const securityLogRules = rules.filter(r => (r.rule_type as string) === 'security_log');

  const isActionEnabled = (role: string, action: string): boolean => {
    const rule = roleRules.find(r => r.target_role === role && r.action_type === action);
    return rule ? rule.is_enabled : true;
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ role, action, enabled }: { role: string; action: string; enabled: boolean }) => {
      const existing = roleRules.find(r => r.target_role === role && r.action_type === action);
      if (existing) {
        const { error } = await supabase
          .from('audit_log_config')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_log_config')
          .insert([{ rule_type: 'role_rule', target_role: role, action_type: action, is_enabled: enabled }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const addBlacklist = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('audit_log_config')
        .insert([{ rule_type: 'blacklist', target_user_id: userId, action_type: '*', is_enabled: false }] as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const removeBlacklist = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('audit_log_config')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const setPreset = useMutation({
    mutationFn: async (preset: 'all' | 'critical') => {
      const criticalActions = ['delete', 'update'];
      for (const role of ['admin', 'agent']) {
        for (const action of ACTION_TYPES) {
          const enabled = preset === 'all' ? true : criticalActions.includes(action);
          const existing = roleRules.find(r => r.target_role === role && r.action_type === action);
          if (existing) {
            await supabase
              .from('audit_log_config')
              .update({ is_enabled: enabled, updated_at: new Date().toISOString() } as any)
              .eq('id', existing.id);
          } else {
            await supabase
              .from('audit_log_config')
              .insert([{ rule_type: 'role_rule', target_role: role, action_type: action, is_enabled: enabled }] as any);
          }
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const hasDisabledRules = roleRules.some(r => !r.is_enabled);

  const isProlongationRuleEnabled = (): boolean => {
    const rule = accessRules.find(r => r.action_type === 'prolongation_30d');
    return rule ? rule.is_enabled : true;
  };

  const toggleProlongationRule = useMutation({
    mutationFn: async (enabled: boolean) => {
      const existing = accessRules.find(r => r.action_type === 'prolongation_30d');
      if (existing) {
        const updates: Record<string, unknown> = {
          is_enabled: enabled,
          updated_at: new Date().toISOString(),
        };
        // If re-enabling manually, clear any bypass
        if (enabled) {
          updates.restriction_bypass_until = null;
        }
        const { error } = await supabase
          .from('audit_log_config')
          .update(updates as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_log_config')
          .insert([{ rule_type: 'access_rule', target_role: null, action_type: 'prolongation_30d', is_enabled: enabled }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const getBypassUntil = (): string | null => {
    const rule = accessRules.find(r => r.action_type === 'prolongation_30d');
    return (rule as any)?.restriction_bypass_until ?? null;
  };

  const isBypassActive = (): boolean => {
    const bypassUntil = getBypassUntil();
    if (!bypassUntil) return false;
    return new Date(bypassUntil).getTime() > Date.now();
  };

  const setBypassUntil = useMutation({
    mutationFn: async (until: string | null) => {
      const existing = accessRules.find(r => r.action_type === 'prolongation_30d');
      if (existing) {
        const updates: Record<string, unknown> = {
          is_enabled: until ? false : true,
          restriction_bypass_until: until,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('audit_log_config')
          .update(updates as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_log_config')
          .insert([{
            rule_type: 'access_rule',
            target_role: null,
            action_type: 'prolongation_30d',
            is_enabled: until ? false : true,
            restriction_bypass_until: until,
          }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const getContactViewLimit = (): number => {
    const rule = rateLimitRules.find(r => r.action_type === 'contact_view_limit');
    return rule?.config_value ?? 30;
  };

  const isContactViewLimitEnabled = (): boolean => {
    const rule = rateLimitRules.find(r => r.action_type === 'contact_view_limit');
    return rule ? rule.is_enabled : true;
  };

  const updateContactViewLimit = useMutation({
    mutationFn: async ({ limit, enabled }: { limit?: number; enabled?: boolean }) => {
      const existing = rateLimitRules.find(r => r.action_type === 'contact_view_limit');
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (limit !== undefined) updates.config_value = limit;
      if (enabled !== undefined) updates.is_enabled = enabled;

      if (existing) {
        const { error } = await supabase
          .from('audit_log_config')
          .update(updates as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_log_config')
          .insert([{ rule_type: 'rate_limit', action_type: 'contact_view_limit', is_enabled: enabled ?? true, config_value: limit ?? 30 }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  const isSecurityLogEnabled = (logType: string): boolean => {
    const rule = securityLogRules.find(r => r.action_type === logType);
    return rule ? rule.is_enabled : true;
  };

  const toggleSecurityLogMutation = useMutation({
    mutationFn: async ({ logType, enabled }: { logType: string; enabled: boolean }) => {
      const existing = securityLogRules.find(r => r.action_type === logType);
      if (existing) {
        const { error } = await supabase
          .from('audit_log_config')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('audit_log_config')
          .insert([{ rule_type: 'security_log', target_role: null, action_type: logType, is_enabled: enabled }] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-log-config'] }),
  });

  return {
    rules,
    roleRules,
    blacklistRules,
    isLoading,
    isActionEnabled,
    toggleAction: toggleMutation.mutate,
    addBlacklist: addBlacklist.mutate,
    removeBlacklist: removeBlacklist.mutate,
    setPreset: setPreset.mutate,
    isTogglingPreset: setPreset.isPending,
    hasDisabledRules,
    isProlongationRuleEnabled,
    toggleProlongationRule: toggleProlongationRule.mutate,
    getBypassUntil,
    isBypassActive,
    setBypassUntil: setBypassUntil.mutate,
    getContactViewLimit,
    isContactViewLimitEnabled,
    updateContactViewLimit: updateContactViewLimit.mutate,
    isSecurityLogEnabled,
    toggleSecurityLog: toggleSecurityLogMutation.mutate,
  };
}
