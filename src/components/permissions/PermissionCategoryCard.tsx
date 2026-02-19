import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface PermSubGroup {
  title?: string;
  items: { key: string; label: string }[];
  /** Mark as directory/setup section for visual distinction */
  isDirectory?: boolean;
}

export interface PermCategoryDef {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subGroups: PermSubGroup[];
  /** Parent key that gates this entire category */
  gatedBy?: string;
}

interface Props {
  category: PermCategoryDef;
  roles: string[];
  permMap: Record<string, boolean>;
  originalMap: Record<string, boolean>;
  onToggle: (role: string, key: string) => void;
  onBulkToggle: (role: string, keys: string[], value: boolean) => void;
  isPermDisabled: (role: string, key: string) => boolean;
  getRoleLabel: (role: string) => string;
  onDisabledClick?: (role: string, key: string) => void;
  highlightedKey?: string | null;
}

const pk = (role: string, key: string) => `${role}::${key}`;

export default function PermissionCategoryCard({
  category,
  roles,
  permMap,
  originalMap,
  onToggle,
  onBulkToggle,
  isPermDisabled,
  getRoleLabel,
  onDisabledClick,
  highlightedKey,
}: Props) {
  const Icon = category.icon;
  const allKeys = useMemo(
    () => category.subGroups.flatMap(sg => sg.items.map(i => i.key)),
    [category]
  );

  const colWidth = roles.length <= 3 ? '100px' : '90px';
  const gridCols = `1fr ${roles.map(() => colWidth).join(' ')}`;

  const getSelectAllState = useCallback(
    (role: string): 'all' | 'none' | 'some' => {
      if (role === 'admin') return 'all';
      const enabledCount = allKeys.filter(k => permMap[pk(role, k)] ?? false).length;
      if (enabledCount === 0) return 'none';
      if (enabledCount === allKeys.length) return 'all';
      return 'some';
    },
    [allKeys, permMap, roles]
  );

  const handleSelectAll = (role: string) => {
    if (role === 'admin') return;
    const state = getSelectAllState(role);
    const newValue = state !== 'all';
    const toggleableKeys = allKeys.filter(k => !isPermDisabled(role, k));
    onBulkToggle(role, toggleableKeys, newValue);
  };

  return (
    <Card className="overflow-hidden">
      {/* Header with select-all */}
      <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
        <div className="grid gap-2 items-center" style={{ gridTemplateColumns: gridCols }}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{category.label}</span>
            <Badge variant="outline" className="text-[10px] ml-1">{allKeys.length}</Badge>
          </div>
          {roles.map(role => {
            const state = getSelectAllState(role);
            const isAdminRole = role === 'admin';
            return (
              <div key={role} className="flex justify-center">
              <Checkbox
                  checked={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
                  onCheckedChange={() => handleSelectAll(role)}
                  disabled={isAdminRole}
                  className={cn(isAdminRole && 'opacity-60 cursor-not-allowed')}
                  aria-label={`Выбрать все ${category.label} для ${getRoleLabel(role)}`}
                />
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {category.subGroups.map((sg, sgIdx) => (
          <div key={sgIdx}>
            {sg.title && (
              <div className={cn(
                "px-4 pt-3 pb-1",
                sg.isDirectory && "bg-muted/40 border-t border-dashed border-border pt-3"
              )}>
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  sg.isDirectory ? "text-primary/70" : "text-muted-foreground"
                )}>
                  {sg.title}
                </span>
              </div>
            )}
            <div className={cn("divide-y divide-border", sg.isDirectory && "bg-muted/20")}>
              {sg.items.map(perm => (
                <div
                  key={perm.key}
                  className={cn(
                    "grid gap-2 px-4 py-2 hover:bg-muted/20 transition-colors items-center",
                    sg.isDirectory && "hover:bg-muted/40"
                  )}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <span className="text-sm text-foreground">{perm.label}</span>
                  {roles.map(role => {
                    const enabled = permMap[pk(role, perm.key)] ?? false;
                    const isAdminRole = role === 'admin';
                    const disabled = isAdminRole || isPermDisabled(role, perm.key);
                    const isChanged = permMap[pk(role, perm.key)] !== originalMap[pk(role, perm.key)];
                    const isHighlighted = highlightedKey === pk(role, perm.key);
                    const isDisabledChild = !isAdminRole && isPermDisabled(role, perm.key);
                    return (
                      <div
                        key={role}
                        className="flex justify-center"
                        onClick={isDisabledChild ? () => onDisabledClick?.(role, perm.key) : undefined}
                      >
                        <Switch
                          checked={isAdminRole ? true : enabled}
                          onCheckedChange={() => onToggle(role, perm.key)}
                          disabled={disabled}
                          className={cn(
                            disabled && !isHighlighted && 'opacity-50 cursor-not-allowed',
                            isChanged && 'ring-2 ring-primary/50',
                            isHighlighted && 'ring-2 ring-primary shadow-md shadow-primary/30 opacity-100 transition-shadow duration-300',
                            isDisabledChild && 'pointer-events-none'
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {sgIdx < category.subGroups.length - 1 && !category.subGroups[sgIdx + 1]?.isDirectory && (
              <div className="border-t-2 border-dashed border-border/50" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
