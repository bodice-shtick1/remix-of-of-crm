import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Copy, Check, Pencil, Trash2, UserRoundCog, Loader2,
  Calendar, Shield, ShieldAlert, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPlateNumber } from '@/hooks/useVehicleCatalog';
import type { VehicleRegistryItem, VehiclePolicy } from '@/hooks/useVehicleRegistryData';
import { VehicleOwnerChangeDialog } from './VehicleOwnerChangeDialog';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface VehicleDetailCardProps {
  vehicle: VehicleRegistryItem;
  policies: VehiclePolicy[];
  policiesLoading: boolean;
  onChangeOwner: (vehicleId: string, newClientId: string) => Promise<void>;
  onUpdate: (vehicleId: string, updates: Record<string, any>) => Promise<void>;
  onDelete: (vehicleId: string) => Promise<void>;
  canManage?: boolean;
}

export function VehicleDetailCard({
  vehicle, policies, policiesLoading, onChangeOwner, onUpdate, onDelete, canManage = true,
}: VehicleDetailCardProps) {
  const navigate = useNavigate();
  const [copiedVin, setCopiedVin] = useState(false);
  const [showOwnerChange, setShowOwnerChange] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const copyVin = () => {
    if (!vehicle.vin_code) return;
    navigator.clipboard.writeText(vehicle.vin_code);
    setCopiedVin(true);
    setTimeout(() => setCopiedVin(false), 2000);
  };

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const val = editValue.trim();
    let updates: Record<string, any> = {};

    if (editingField === 'year') {
      updates.year = val ? parseInt(val) || null : null;
    } else if (editingField === 'color') {
      updates.color = val || null;
    } else if (editingField === 'vin_code') {
      updates.vin_code = val.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17) || null;
    }

    await onUpdate(vehicle.id, updates);
    setEditingField(null);
  };

  const activePolicies = policies.filter(p => p.status === 'active' || p.status === 'expiring_soon');
  const hasActivePolicy = activePolicies.length > 0;

  const policyStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'expiring_soon': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'expired': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const policyStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Активен';
      case 'expiring_soon': return 'Истекает';
      case 'expired': return 'Истёк';
      case 'renewed': return 'Продлён';
      default: return status;
    }
  };

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Header with plate */}
          <div className="flex items-start justify-between">
            <div>
              {vehicle.plate_number ? (
                <div className="inline-block bg-background border-2 border-foreground/30 rounded-md px-4 py-1.5 font-mono text-lg font-bold tracking-widest">
                  {formatPlateNumber(vehicle.plate_number)}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">Нет госномера</div>
              )}
              <div className="mt-1 text-lg font-semibold">
                {vehicle.brand_name} {vehicle.model_name || ''}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1 text-xs"
                  onClick={() => onDelete(vehicle.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              </div>
            )}
          </div>

          {/* Passport */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Паспорт ТС
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <DetailRow
                label="VIN-код"
                value={vehicle.vin_code || '—'}
                mono
                editing={editingField === 'vin_code'}
                editValue={editValue}
                onEditChange={setEditValue}
                onStartEdit={() => startEdit('vin_code', vehicle.vin_code || '')}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
                suffix={vehicle.vin_code ? (
                  <button onClick={copyVin} className="text-muted-foreground hover:text-foreground ml-1">
                    {copiedVin ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                ) : undefined}
              />
              <DetailRow
                label="Год выпуска"
                value={vehicle.year?.toString() || '—'}
                editing={editingField === 'year'}
                editValue={editValue}
                onEditChange={setEditValue}
                onStartEdit={() => startEdit('year', vehicle.year?.toString() || '')}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
              />
              <DetailRow
                label="Цвет"
                value={vehicle.color || '—'}
                editing={editingField === 'color'}
                editValue={editValue}
                onEditChange={setEditValue}
                onStartEdit={() => startEdit('color', vehicle.color || '')}
                onSave={saveEdit}
                onCancel={() => setEditingField(null)}
              />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Статус:</span>
                {hasActivePolicy ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <Shield className="h-3 w-3 mr-1" /> Застрахован
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                    <ShieldAlert className="h-3 w-3 mr-1" /> Нет полиса
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Owner */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Владелец
              </h4>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowOwnerChange(true)}
                >
                  <UserRoundCog className="h-3.5 w-3.5" />
                  Смена владельца
                </Button>
              )}
            </div>
            {vehicle.client_name ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{vehicle.client_name}</span>
                {vehicle.last_customer_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => navigate(`/clients`)}
                    title="Перейти к клиенту"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Не привязан</p>
            )}
          </div>

          <Separator />

          {/* Insurance History Timeline */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              История страхования
            </h4>
            {policiesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : policies.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Нет записей о полисах</p>
            ) : (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />

                {policies.map((policy, idx) => {
                  const year = new Date(policy.start_date).getFullYear();
                  const prevYear = idx > 0 ? new Date(policies[idx - 1].start_date).getFullYear() : null;
                  const showYear = year !== prevYear;

                  return (
                    <div key={policy.id} className="relative mb-3 last:mb-0">
                      {/* Dot */}
                      <div className={cn(
                        'absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                        policy.status === 'active' || policy.status === 'expiring_soon'
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground/30'
                      )} />

                      <div className="bg-muted/30 rounded-md p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{policy.policy_type}</span>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', policyStatusColor(policy.status))}>
                              {policyStatusLabel(policy.status)}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {policy.policy_series ? `${policy.policy_series} ` : ''}{policy.policy_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{policy.insurance_company}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(policy.start_date), 'dd.MM.yyyy')} — {format(new Date(policy.end_date), 'dd.MM.yyyy')}
                          </span>
                          <span>•</span>
                          <span>{policy.premium_amount.toLocaleString('ru-RU')} ₽</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {showOwnerChange && (
        <VehicleOwnerChangeDialog
          vehicleId={vehicle.id}
          currentOwner={vehicle.client_name || null}
          onConfirm={async (clientId) => {
            await onChangeOwner(vehicle.id, clientId);
            setShowOwnerChange(false);
          }}
          onClose={() => setShowOwnerChange(false)}
        />
      )}
    </>
  );
}

// Inline editable detail row
function DetailRow({
  label, value, mono, editing, editValue, onEditChange, onStartEdit, onSave, onCancel, suffix,
}: {
  label: string;
  value: string;
  mono?: boolean;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  suffix?: React.ReactNode;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-1 col-span-1">
        <span className="text-muted-foreground shrink-0">{label}:</span>
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          className="h-7 text-sm flex-1"
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn('font-medium', mono && 'font-mono text-xs tracking-wider')}>
        {value}
      </span>
      {suffix}
      <button
        onClick={onStartEdit}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground ml-1 transition-opacity"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
