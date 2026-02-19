import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Archive } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ARCHIVE_REASONS = [
  { value: 'sold', label: 'Продано' },
  { value: 'refused', label: 'Отказ' },
  { value: 'consultation', label: 'Консультация' },
];

interface ArchiveChatDialogProps {
  onArchive: (reason: string) => void;
  disabled?: boolean;
}

export function ArchiveChatDialog({ onArchive, disabled }: ArchiveChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('consultation');

  const handleConfirm = () => {
    onArchive(reason);
    setOpen(false);
    setReason('consultation');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30" disabled={disabled}>
              <Archive className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Завершить и архивировать диалог</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="end" className="w-56 p-3">
        <p className="text-sm font-medium mb-2">Причина завершения</p>
        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {ARCHIVE_REASONS.map(r => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`archive-${r.value}`} />
              <Label htmlFor={`archive-${r.value}`} className="text-sm cursor-pointer">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Button size="sm" className="w-full mt-3" onClick={handleConfirm}>
          Завершить диалог
        </Button>
      </PopoverContent>
    </Popover>
  );
}
