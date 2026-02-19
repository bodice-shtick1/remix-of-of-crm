import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logEventDirect } from '@/hooks/useEventLog';

const DEFAULT_GOAL = 1_000_000;

export function useMonthlyGoal() {
  const { user } = useAuth();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    
    supabase
      .from('agent_settings')
      .select('monthly_goal')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.monthly_goal != null) {
          setGoal(Number(data.monthly_goal));
        }
        setLoading(false);
      });
  }, [user?.id]);

  const saveGoal = useCallback(async (value: number) => {
    if (!user?.id) return;
    setGoal(value);

    const { data: existing } = await supabase
      .from('agent_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('agent_settings')
        .update({ monthly_goal: value } as any)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('agent_settings')
        .insert({ user_id: user.id, monthly_goal: value } as any);
    }
    logEventDirect({ action: 'settings_change', category: 'service', entityType: 'monthly_goal', fieldAccessed: 'План на месяц', newValue: `${value.toLocaleString('ru-RU')} ₽` });
  }, [user?.id]);

  return { goal, saveGoal, loading };
}
