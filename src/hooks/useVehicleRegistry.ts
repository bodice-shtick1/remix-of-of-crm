import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getRawPlateNumber, normalizePlateNumber } from './useVehicleCatalog';

export interface VehicleRegistryData {
  id: string;
  vin_code: string | null;
  plate_number: string | null;
  brand_name: string;
  model_name: string | null;
  last_customer_id: string | null;
}

export function useVehicleRegistry() {
  // Lookup vehicle by plate number in vehicle_registry
  const lookupByPlate = useCallback(async (plateNumber: string): Promise<VehicleRegistryData | null> => {
    const raw = getRawPlateNumber(plateNumber);
    const normalized = normalizePlateNumber(raw);
    if (normalized.length < 6) return null;

    try {
      const { data, error } = await supabase
        .from('vehicle_registry')
        .select('*')
        .ilike('plate_number', `%${normalized.replace(/[^a-zа-я0-9]/gi, '')}%`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error looking up vehicle registry:', error);
        return null;
      }
      return data as VehicleRegistryData | null;
    } catch {
      return null;
    }
  }, []);

  // Lookup vehicle by VIN
  const lookupByVin = useCallback(async (vin: string): Promise<VehicleRegistryData | null> => {
    if (!vin || vin.length < 5) return null;

    try {
      const { data, error } = await supabase
        .from('vehicle_registry')
        .select('*')
        .ilike('vin_code', vin.toUpperCase())
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error looking up vehicle by VIN:', error);
        return null;
      }
      return data as VehicleRegistryData | null;
    } catch {
      return null;
    }
  }, []);

  // Upsert vehicle in registry (called on sale save)
  const upsertVehicle = useCallback(async (params: {
    plateNumber?: string;
    vinCode?: string;
    brandName: string;
    modelName?: string;
    customerId?: string;
  }): Promise<boolean> => {
    const { plateNumber, vinCode, brandName, modelName, customerId } = params;
    
    if (!brandName) return false;
    const rawPlate = plateNumber ? getRawPlateNumber(plateNumber) : null;

    try {
      // Check if vehicle exists by plate
      if (rawPlate && rawPlate.length >= 6) {
        const normalized = normalizePlateNumber(rawPlate);
        const { data: existing } = await supabase
          .from('vehicle_registry')
          .select('id')
          .ilike('plate_number', normalized)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('vehicle_registry')
            .update({
              vin_code: vinCode?.toUpperCase() || undefined,
              brand_name: brandName,
              model_name: modelName || null,
              last_customer_id: customerId || null,
            })
            .eq('id', existing.id);
          return true;
        }
      }

      // Check by VIN
      if (vinCode && vinCode.length === 17) {
        const { data: existingVin } = await supabase
          .from('vehicle_registry')
          .select('id')
          .ilike('vin_code', vinCode.toUpperCase())
          .maybeSingle();

        if (existingVin) {
          await supabase
            .from('vehicle_registry')
            .update({
              plate_number: rawPlate || undefined,
              brand_name: brandName,
              model_name: modelName || null,
              last_customer_id: customerId || null,
            })
            .eq('id', existingVin.id);
          return true;
        }
      }

      // Insert new
      await supabase
        .from('vehicle_registry')
        .insert({
          plate_number: rawPlate || null,
          vin_code: vinCode?.toUpperCase() || null,
          brand_name: brandName,
          model_name: modelName || null,
          last_customer_id: customerId || null,
        });

      // Also upsert into car_brands_models
      await supabase
        .from('car_brands_models')
        .upsert(
          { brand: brandName, model: modelName || null },
          { onConflict: 'brand,model', ignoreDuplicates: true }
        ).select();

      return true;
    } catch (err) {
      console.error('Error upserting vehicle:', err);
      return false;
    }
  }, []);

  // Load brand suggestions
  const searchBrands = useCallback(async (query: string): Promise<string[]> => {
    if (!query || query.length < 1) return [];
    try {
      const { data } = await supabase
        .from('car_brands_models')
        .select('brand')
        .ilike('brand', `%${query}%`)
        .limit(20);
      
      const unique = [...new Set((data || []).map(d => d.brand))];
      return unique;
    } catch {
      return [];
    }
  }, []);

  // Load model suggestions for a brand
  const searchModels = useCallback(async (brand: string, query: string): Promise<string[]> => {
    if (!brand) return [];
    try {
      let q = supabase
        .from('car_brands_models')
        .select('model')
        .ilike('brand', brand)
        .not('model', 'is', null);
      
      if (query) {
        q = q.ilike('model', `%${query}%`);
      }
      
      const { data } = await q.limit(20);
      return (data || []).map(d => d.model).filter(Boolean) as string[];
    } catch {
      return [];
    }
  }, []);

  return {
    lookupByPlate,
    lookupByVin,
    upsertVehicle,
    searchBrands,
    searchModels,
  };
}
