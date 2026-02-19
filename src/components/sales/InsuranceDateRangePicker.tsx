import { useState, useCallback, useRef } from 'react';
import { format, addMonths, addYears, subDays, parse, isValid, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InsuranceDateRangePickerProps {
  startDate?: string; // yyyy-MM-dd
  endDate?: string;   // yyyy-MM-dd
  onDateChange: (startDate: string, endDate: string) => void;
  onComplete?: () => void;
  triggerRef?: (el: HTMLButtonElement | null) => void;
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += '.';
    result += digits[i];
  }
  return result;
}

function parseManualDate(text: string): Date | null {
  if (text.length !== 10) return null;
  const d = parse(text, 'dd.MM.yyyy', new Date());
  return isValid(d) ? d : null;
}

export function InsuranceDateRangePicker({ startDate, endDate, onDateChange, onComplete, triggerRef }: InsuranceDateRangePickerProps) {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const start = startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined;
  const end = endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined;

  const today = startOfDay(new Date());

  const disabledDays = isAdmin ? undefined : { before: today };

  const formatDisplay = (d: Date | undefined) => d ? format(d, 'dd.MM.yyyy') : '__.__.____';

  const endManuallyEdited = useRef(false);

  const handleStartSelect = useCallback((day: Date | undefined) => {
    if (!day) return;
    if (!isAdmin && day < today) {
      toast.warning('Дата в прошлом недоступна');
      return;
    }
    const newStart = format(day, 'yyyy-MM-dd');
    // Only auto-suggest end date if user hasn't manually changed it
    const newEnd = endManuallyEdited.current && endDate
      ? endDate
      : format(subDays(addYears(day, 1), 1), 'yyyy-MM-dd');
    onDateChange(newStart, newEnd);
    setSelectingEnd(true);
  }, [isAdmin, today, onDateChange, endDate]);

  const handleEndSelect = useCallback((day: Date | undefined) => {
    if (!day) return;
    if (start && day < start) {
      toast.warning('Дата окончания не может быть раньше начала');
      return;
    }
    endManuallyEdited.current = true;
    const newEnd = format(day, 'yyyy-MM-dd');
    onDateChange(startDate || format(today, 'yyyy-MM-dd'), newEnd);
    setSelectingEnd(false);
    setOpen(false);
    onComplete?.();
  }, [start, startDate, today, onDateChange, onComplete]);

  const applyPreset = useCallback((months: number) => {
    const s = start || today;
    const newEnd = format(subDays(addMonths(s, months), 1), 'yyyy-MM-dd');
    onDateChange(format(s, 'yyyy-MM-dd'), newEnd);
    setOpen(false);
    onComplete?.();
  }, [start, today, onDateChange, onComplete]);

  const commitStartInput = useCallback(() => {
    setEditingStart(false);
    const d = parseManualDate(startInput);
    if (!d) {
      if (startInput.length > 0) toast.warning('Неверный формат даты. Используйте ДД.ММ.ГГГГ');
      return;
    }
    if (!isAdmin && d < today) {
      toast.warning('Дата в прошлом недоступна');
      return;
    }
    const newStart = format(d, 'yyyy-MM-dd');
    const newEnd = endManuallyEdited.current && endDate
      ? endDate
      : format(subDays(addYears(d, 1), 1), 'yyyy-MM-dd');
    onDateChange(newStart, newEnd);
  }, [startInput, isAdmin, today, onDateChange, endDate]);

  const commitEndInput = useCallback(() => {
    setEditingEnd(false);
    const d = parseManualDate(endInput);
    if (!d) {
      if (endInput.length > 0) toast.warning('Неверный формат даты. Используйте ДД.ММ.ГГГГ');
      return;
    }
    if (start && d < start) {
      toast.warning('Дата окончания не может быть раньше начала');
      return;
    }
    endManuallyEdited.current = true;
    onDateChange(startDate || format(today, 'yyyy-MM-dd'), format(d, 'yyyy-MM-dd'));
  }, [endInput, start, startDate, today, onDateChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef as any}
          variant="outline"
          className={cn(
            "h-7 px-1.5 text-xs justify-start font-normal w-full gap-1 whitespace-nowrap",
            (!start || !end) && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {formatDisplay(start)} — {formatDisplay(end)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[200]" align="start" sideOffset={4}>
        <div className="p-2 space-y-2">
          {/* Manual date inputs */}
          <div className="flex items-center gap-1 text-xs">
            <input
              ref={startRef}
              className="w-[78px] h-6 px-1 border rounded text-[11px] text-center bg-background border-input focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="ДД.ММ.ГГГГ"
              value={editingStart ? startInput : formatDisplay(start)}
              onFocus={() => {
                setEditingStart(true);
                setStartInput(start ? format(start, 'dd.MM.yyyy') : '');
              }}
              onChange={(e) => setStartInput(maskDate(e.target.value))}
              onBlur={commitStartInput}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitStartInput(); startRef.current?.blur(); } }}
              maxLength={10}
            />
            <span className="text-muted-foreground">—</span>
            <input
              ref={endRef}
              className="w-[78px] h-6 px-1 border rounded text-[11px] text-center bg-background border-input focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="ДД.ММ.ГГГГ"
              value={editingEnd ? endInput : formatDisplay(end)}
              onFocus={() => {
                setEditingEnd(true);
                setEndInput(end ? format(end, 'dd.MM.yyyy') : '');
              }}
              onChange={(e) => setEndInput(maskDate(e.target.value))}
              onBlur={commitEndInput}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEndInput(); endRef.current?.blur(); } }}
              maxLength={10}
            />
          </div>

          <div className="flex gap-1 justify-center">
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => applyPreset(3)}>3 мес</Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => applyPreset(6)}>6 мес</Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => applyPreset(12)}>1 год</Button>
          </div>

          <div className="text-[10px] text-center text-muted-foreground font-medium">
            {selectingEnd ? 'Выберите дату окончания' : 'Выберите дату начала'}
          </div>

          <Calendar
            mode="single"
            selected={selectingEnd ? end : start}
            onSelect={selectingEnd ? handleEndSelect : handleStartSelect}
            disabled={disabledDays}
            defaultMonth={selectingEnd ? (end || start || today) : (start || today)}
            locale={ru}
            className="p-1 pointer-events-auto"
            modifiers={{
              range_start: start ? [start] : [],
              range_end: end ? [end] : [],
            }}
            modifiersClassNames={{
              range_start: 'bg-primary text-primary-foreground rounded-l-md',
              range_end: 'bg-primary text-primary-foreground rounded-r-md',
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
