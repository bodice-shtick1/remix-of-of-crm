import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatPlateNumber, getRawPlateNumber, isValidPlateNumber } from '@/hooks/useVehicleCatalog';
import { validatePlateChar, triggerShake } from '@/lib/inputValidation';

interface VehiclePlateInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidPlate?: (plateNumber: string) => void;
  onEnter?: () => void;
  className?: string;
  placeholder?: string;
}

export interface VehiclePlateInputRef {
  focus: () => void;
}

// Valid Russian letters for license plates
const VALID_PLATE_LETTERS = 'АВЕКМНОРСТУХ';
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М',
  'H': 'Н', 'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т',
  'Y': 'У', 'X': 'Х'
};

export const VehiclePlateInput = forwardRef<VehiclePlateInputRef, VehiclePlateInputProps>(({
  value,
  onChange,
  onValidPlate,
  onEnter,
  className,
  placeholder = 'А 777 АА 777',
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(() => formatPlateNumber(value || ''));
  const [hasTriggered, setHasTriggered] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Sync external value
  useEffect(() => {
    const formatted = formatPlateNumber(value || '');
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  // Convert input character to valid plate character
  const processChar = useCallback((char: string): string => {
    const upper = char.toUpperCase();
    if (/\d/.test(char)) return char;
    if (LATIN_TO_CYRILLIC[upper]) return LATIN_TO_CYRILLIC[upper];
    if (VALID_PLATE_LETTERS.includes(upper)) return upper;
    return '';
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    let processed = '';
    for (const char of inputValue.replace(/\s/g, '')) {
      const validChar = processChar(char);
      if (validChar) {
        processed += validChar;
      }
    }
    const formatted = formatPlateNumber(processed);
    setDisplayValue(formatted);
    const rawValue = getRawPlateNumber(formatted);
    onChange(rawValue);

    if (isValidPlateNumber(rawValue) && !hasTriggered) {
      setHasTriggered(true);
      onValidPlate?.(rawValue);
    } else if (!isValidPlateNumber(rawValue) && hasTriggered) {
      setHasTriggered(false);
    }
  }, [onChange, onValidPlate, processChar, hasTriggered]);

  const handleBlur = useCallback(() => {
    const rawValue = getRawPlateNumber(displayValue);
    if (isValidPlateNumber(rawValue)) {
      onValidPlate?.(rawValue);
    }
  }, [displayValue, onValidPlate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Tab'].includes(e.key)) {
      return;
    }
    if (!validatePlateChar(e.key, wrapperRef.current)) {
      e.preventDefault();
    }
  }, [onEnter]);

  return (
    <div ref={wrapperRef}>
      <Input
        ref={inputRef}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-7 text-xs uppercase font-mono tracking-wider px-1.5",
          isValidPlateNumber(getRawPlateNumber(displayValue)) && "border-success/50 bg-success/5",
          className
        )}
        placeholder={placeholder}
        maxLength={12}
      />
    </div>
  );
});

VehiclePlateInput.displayName = 'VehiclePlateInput';
