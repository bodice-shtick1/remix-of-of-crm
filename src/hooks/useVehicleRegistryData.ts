import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

export interface VehicleRegistryItem {
  id: string;
  vin_code: string | null;
  plate_number: string | null;
  brand_name: string;
  brand_id: string | null;
  model_name: string | null;
  last_customer_id: string | null;
  year: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
  client_phone?: string;
}

export interface VehiclePolicy {
  id: string;
  policy_type: string;
  policy_number: string;
  policy_series: string | null;
  insurance_company: string;
  premium_amount: number;
  start_date: string;
  end_date: string;
  status: string;
  vehicle_number: string | null;
  vehicle_model: string | null;
}

export function useVehicleRegistryData() {
  const { toast } = useToast();
  const [items, setItems] = useState<VehicleRegistryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<VehiclePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [filterNoPolicy, setFilterNoPolicy] = useState(false);
  const [filterBrand, setFilterBrand] = useState('');
  const [brands, setBrands] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_registry')
        .select(`
          *,
          client:clients!vehicle_registry_last_customer_id_fkey (
            first_name, last_name, company_name, is_company, phone
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((v: any) => ({
        ...v,
        client_name: v.client
          ? (v.client.is_company ? v.client.company_name : `${v.client.last_name} ${v.client.first_name}`)
          : null,
        client_phone: v.client?.phone || null,
      }));
      setItems(mapped);

      const uniqueBrands = [...new Set(mapped.map((v: VehicleRegistryItem) => v.brand_name))].sort() as string[];
      setBrands(uniqueBrands);
    } catch (err) {
      console.error('Error loading vehicle registry:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  // Load policies for selected vehicle
  const loadPolicies = useCallback(async (vehicle: VehicleRegistryItem) => {
    setPoliciesLoading(true);
    try {
      // Match by plate_number or vehicle_model containing brand
      let query = supabase.from('policies').select('*').order('start_date', { ascending: false });

      const conditions: string[] = [];
      if (vehicle.plate_number) {
        conditions.push(`vehicle_number.ilike.%${vehicle.plate_number.replace(/\s/g, '').toLowerCase()}%`);
      }

      if (conditions.length === 0) {
        setPolicies([]);
        setPoliciesLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .or(conditions.join(','))
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPolicies((data || []) as VehiclePolicy[]);
    } catch (err) {
      console.error('Error loading policies:', err);
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      loadPolicies(selected);
    } else {
      setPolicies([]);
    }
  }, [selected, loadPolicies]);

  // Determine which vehicles have active policies
  const vehiclesWithActivePolicies = useMemo(() => {
    // We'll do a simple check: vehicles whose plate appears in an active policy
    // For performance we just track it client-side after initial load
    return new Set<string>();
  }, []);

  // Filtered items
  const filtered = useMemo(() => {
    let result = items;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.plate_number && i.plate_number.toLowerCase().includes(q)) ||
        (i.vin_code && i.vin_code.toLowerCase().includes(q)) ||
        i.brand_name.toLowerCase().includes(q) ||
        (i.model_name && i.model_name.toLowerCase().includes(q)) ||
        (i.client_name && i.client_name.toLowerCase().includes(q))
      );
    }

    if (filterBrand) {
      result = result.filter(i => i.brand_name === filterBrand);
    }

    return result;
  }, [items, search, filterBrand]);

  const changeOwner = useCallback(async (vehicleId: string, newClientId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_registry')
        .update({ last_customer_id: newClientId })
        .eq('id', vehicleId);
      if (error) throw error;
      toast({ title: 'Владелец изменён' });
      logEventDirect({ action: 'update', category: 'clients', entityType: 'vehicle', entityId: vehicleId, fieldAccessed: 'Смена владельца ТС', newValue: newClientId });
      loadData();
    } catch {
      toast({ title: 'Ошибка смены владельца', variant: 'destructive' });
    }
  }, [toast, loadData]);

  const updateVehicle = useCallback(async (vehicleId: string, updates: {
    year?: number | null;
    color?: string | null;
    vin_code?: string | null;
    plate_number?: string | null;
    brand_name?: string;
    model_name?: string | null;
  }) => {
    try {
      const { error } = await supabase
        .from('vehicle_registry')
        .update(updates)
        .eq('id', vehicleId);
      if (error) throw error;
      toast({ title: 'Данные обновлены' });
      logEventDirect({ action: 'update', category: 'clients', entityType: 'vehicle', entityId: vehicleId, fieldAccessed: 'Редактирование ТС', details: updates as Record<string, unknown> });
      loadData();
    } catch {
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    }
  }, [toast, loadData]);

  const deleteVehicle = useCallback(async (vehicleId: string) => {
    try {
      const { error } = await supabase.from('vehicle_registry').delete().eq('id', vehicleId);
      if (error) throw error;
      toast({ title: 'ТС удалено' });
      logEventDirect({ action: 'delete', category: 'clients', entityType: 'vehicle', entityId: vehicleId, fieldAccessed: 'Удаление ТС' });
      if (selectedId === vehicleId) setSelectedId(null);
      loadData();
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    }
  }, [toast, loadData, selectedId]);

  return {
    items, filtered, isLoading, search, setSearch,
    selectedId, setSelectedId, selected,
    policies, policiesLoading,
    filterNoPolicy, setFilterNoPolicy,
    filterBrand, setFilterBrand, brands,
    changeOwner, updateVehicle, deleteVehicle,
    reload: loadData,
  };
}
