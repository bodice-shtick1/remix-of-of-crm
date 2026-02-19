import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VehicleData {
  id: string;
  plate_number: string;
  brand: string;
  model: string | null;
}

// Normalize plate number for comparison (remove spaces, lowercase)
export const normalizePlateNumber = (plate: string): string => {
  return plate.replace(/\s/g, '').toLowerCase();
};

// Valid Russian letters for license plates (with Latin equivalents)
const VALID_PLATE_LETTERS = 'АВЕКМНОРСТУХ';
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М',
  'H': 'Н', 'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т',
  'Y': 'У', 'X': 'Х'
};

// Convert Latin letters to Cyrillic equivalents
export const convertToCyrillic = (char: string): string => {
  const upper = char.toUpperCase();
  return LATIN_TO_CYRILLIC[upper] || (VALID_PLATE_LETTERS.includes(upper) ? upper : '');
};

// Format plate number for display: А 777 АА 777
export const formatPlateNumber = (raw: string): string => {
  // Remove all spaces and convert to uppercase
  const cleaned = raw.replace(/\s/g, '').toUpperCase();
  
  // Convert Latin to Cyrillic
  let converted = '';
  for (const char of cleaned) {
    if (/\d/.test(char)) {
      converted += char;
    } else {
      const cyrChar = convertToCyrillic(char);
      if (cyrChar) {
        converted += cyrChar;
      }
    }
  }
  
  // Standard format: Б000ББ00(0)
  // Position: 0-letter, 1-3 digits, 4-5 letters, 6-8 region digits
  if (converted.length === 0) return '';
  
  let result = '';
  let letterCount = 0;
  let digitCount = 0;
  let regionStarted = false;
  
  for (const char of converted) {
    const isDigit = /\d/.test(char);
    const isLetter = VALID_PLATE_LETTERS.includes(char);
    
    if (!regionStarted) {
      // First letter
      if (letterCount === 0 && isLetter) {
        result += char;
        letterCount++;
      }
      // Digits after first letter (3 digits)
      else if (letterCount === 1 && digitCount < 3 && isDigit) {
        if (digitCount === 0) result += ' ';
        result += char;
        digitCount++;
      }
      // Two more letters
      else if (letterCount >= 1 && letterCount < 3 && digitCount === 3 && isLetter) {
        if (letterCount === 1) result += ' ';
        result += char;
        letterCount++;
        if (letterCount === 3) {
          regionStarted = true;
          digitCount = 0;
        }
      }
    } else {
      // Region digits (2-3)
      if (digitCount < 3 && isDigit) {
        if (digitCount === 0) result += ' ';
        result += char;
        digitCount++;
      }
    }
  }
  
  return result;
};

// Get raw plate number from formatted
export const getRawPlateNumber = (formatted: string): string => {
  return formatted.replace(/\s/g, '');
};

// Validate if plate number is complete
export const isValidPlateNumber = (plate: string): boolean => {
  const raw = getRawPlateNumber(plate);
  // Minimum valid: Б000ББ00 (8 chars), Maximum: Б000ББ000 (9 chars)
  return raw.length >= 8 && raw.length <= 9;
};

export function useVehicleCatalog() {
  const [isLoading, setIsLoading] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);

  // Look up vehicle by plate number (uses vehicle_registry as single source of truth)
  const lookupByPlateNumber = useCallback(async (plateNumber: string): Promise<VehicleData | null> => {
    const normalized = normalizePlateNumber(plateNumber);
    if (normalized.length < 6) return null;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicle_registry')
        .select('id, plate_number, brand_name, model_name')
        .not('plate_number', 'is', null)
        .ilike('plate_number', `%${normalized.replace(/[^a-zа-я0-9]/gi, '')}%`)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error looking up vehicle:', error);
        return null;
      }
      
      if (data) {
        const mapped: VehicleData = {
          id: data.id,
          plate_number: data.plate_number!,
          brand: data.brand_name,
          model: data.model_name,
        };
        setVehicleData(mapped);
        return mapped;
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save or update vehicle in registry
  const saveVehicle = useCallback(async (plateNumber: string, brand: string, model?: string): Promise<boolean> => {
    const normalized = normalizePlateNumber(plateNumber);
    
    if (!normalized || !brand) return false;
    
    try {
      const raw = getRawPlateNumber(plateNumber);
      const { data: existing } = await supabase
        .from('vehicle_registry')
        .select('id')
        .not('plate_number', 'is', null)
        .ilike('plate_number', normalized)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('vehicle_registry')
          .update({ brand_name: brand, model_name: model || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vehicle_registry')
          .insert({ plate_number: raw, brand_name: brand, model_name: model || null });
        
        if (error) throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast.error('Ошибка сохранения данных автомобиля');
      return false;
    }
  }, []);

  return {
    isLoading,
    vehicleData,
    lookupByPlateNumber,
    saveVehicle,
    formatPlateNumber,
    getRawPlateNumber,
    isValidPlateNumber,
  };
}
