import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Car } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BrandModelOption {
  brand: string;
  model: string | null;
  id: string;
}

interface VehicleBrandModelComboboxProps {
  brandValue: string;
  modelValue: string;
  onSelect: (brand: string, model: string) => void;
  className?: string;
  disabled?: boolean;
}

export function VehicleBrandModelCombobox({
  brandValue,
  modelValue,
  onSelect,
  className,
  disabled,
}: VehicleBrandModelComboboxProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<BrandModelOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  // Display value
  const displayValue = brandValue
    ? `${brandValue}${modelValue ? ` ${modelValue}` : ''}`
    : '';

  // Sync external changes
  useEffect(() => {
    if (!isOpen) {
      setQuery(displayValue);
    }
  }, [displayValue, isOpen]);

  // Search logic — searches concatenated "brand model" string
  const search = useCallback(async (q: string) => {
    if (!q || q.length < 1) {
      // Show all when empty to allow browsing
      setLoading(true);
      try {
        const { data } = await supabase
          .from('car_brands_models')
          .select('id, brand, model')
          .order('brand')
          .limit(30);
        setOptions((data || []) as BrandModelOption[]);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const trimmed = q.trim().toLowerCase();
      const parts = trimmed.split(/\s+/);

      // Strategy: fetch broadly by first keyword in brand OR model, then filter client-side
      const firstWord = parts[0];

      const { data } = await supabase
        .from('car_brands_models')
        .select('id, brand, model')
        .or(`brand.ilike.%${firstWord}%,model.ilike.%${firstWord}%`)
        .order('brand')
        .limit(100);

      const results = (data || []) as BrandModelOption[];

      // Client-side filter: every query word must appear in "brand model"
      const filtered = results.filter((item) => {
        const full = `${item.brand} ${item.model || ''}`.toLowerCase();
        return parts.every((p) => full.includes(p));
      });

      setOptions(filtered.slice(0, 30));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, isOpen, search]);

  // Click outside — check both container and portal dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        listRef.current && !listRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220;
    setDropdownPos({
      top: openUp ? rect.top + window.scrollY : rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  // Parse query into brand + model for creation
  const parseNewEntry = (): { brand: string; model: string } | null => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return { brand: parts[0], model: '' };
    return { brand: parts[0], model: parts.slice(1).join(' ') };
  };

  const showAddButton = (): boolean => {
    if (!query.trim()) return false;
    const parsed = parseNewEntry();
    if (!parsed) return false;
    // Check if exact match exists
    return !options.some(
      (o) =>
        o.brand.toLowerCase() === parsed.brand.toLowerCase() &&
        (o.model || '').toLowerCase() === parsed.model.toLowerCase()
    );
  };

  const handleAddNew = async () => {
    const parsed = parseNewEntry();
    if (!parsed || !parsed.brand) return;

    try {
      // Ensure brand exists (insert brand-only row if no models yet)
      const { data: existingBrand } = await supabase
        .from('car_brands_models')
        .select('id')
        .ilike('brand', parsed.brand)
        .limit(1)
        .maybeSingle();

      if (!existingBrand && !parsed.model) {
        // Create brand-only entry
        const { error } = await supabase
          .from('car_brands_models')
          .insert({ brand: parsed.brand, model: null });
        if (error) throw error;
      } else if (parsed.model) {
        // Create brand+model entry (brand is stored as text, so duplicates are fine)
        const { error } = await supabase
          .from('car_brands_models')
          .insert({ brand: parsed.brand, model: parsed.model });
        if (error) throw error;
      }

      toast.success(
        parsed.model
          ? `${parsed.brand} ${parsed.model} добавлено в справочник`
          : `${parsed.brand} добавлена в справочник`
      );

      onSelect(parsed.brand, parsed.model);
      setIsOpen(false);
    } catch (err) {
      console.error('Error adding brand/model:', err);
      toast.error('Ошибка добавления');
    }
  };

  const handleSelect = (option: BrandModelOption) => {
    onSelect(option.brand, option.model || '');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = options.length + (showAddButton() ? 1 : 0) - 1;
      setHighlightIndex((prev) => Math.min(prev + 1, max));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < options.length) {
        handleSelect(options[highlightIndex]);
      } else if (showAddButton() && highlightIndex === options.length) {
        handleAddNew();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery(displayValue);
    }
  };

  // Scroll highlight into view
  useEffect(() => {
    if (listRef.current && highlightIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Car className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={isOpen ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setQuery(displayValue);
            setIsOpen(true);
            search(displayValue);
          }}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs pl-6 pr-1.5"
          placeholder="Марка Модель"
          disabled={disabled}
        />
      </div>

      {isOpen && dropdownPos && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            left: dropdownPos.left,
            width: dropdownPos.width,
            ...(dropdownPos.openUp
              ? { bottom: window.innerHeight - dropdownPos.top + 2 }
              : { top: dropdownPos.top + 2 }),
          }}
          className="z-[200] max-h-[200px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Поиск...</div>
          )}

          {!loading && options.length === 0 && query.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Нет совпадений</div>
          )}

          {options.map((option, i) => (
            <div
              key={option.id}
              data-option
              className={cn(
                'px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-accent',
                highlightIndex === i && 'bg-accent'
              )}
              onMouseEnter={() => setHighlightIndex(i)}
              onClick={() => handleSelect(option)}
            >
              <span className="font-medium">{option.brand}</span>
              {option.model && (
                <span className="text-muted-foreground">{option.model}</span>
              )}
            </div>
          ))}

          {showAddButton() && (() => {
            const parsed = parseNewEntry();
            if (!parsed) return null;
            const addIndex = options.length;
            return (
              <div
                data-option
                className={cn(
                  'px-3 py-1.5 text-xs cursor-pointer flex items-center gap-1.5 border-t hover:bg-accent text-primary',
                  highlightIndex === addIndex && 'bg-accent'
                )}
                onMouseEnter={() => setHighlightIndex(addIndex)}
                onClick={handleAddNew}
              >
                <Plus className="h-3 w-3" />
                <span>
                  Добавить{' '}
                  {parsed.model ? (
                    <>
                      модель <b>{parsed.model}</b> к марке <b>{parsed.brand}</b>
                    </>
                  ) : (
                    <>
                      марку <b>{parsed.brand}</b>
                    </>
                  )}
                </span>
              </div>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
