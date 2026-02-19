import { useCallback } from 'react';
import { ServiceCatalog, SaleItemRow } from '@/components/sales/SaleItemsTableInline';

interface UseRoundingParams {
  services: ServiceCatalog[];
  preferredRoundingServiceId: string | null;
  roundingStep: number;
  isRoundingEnabled: boolean;
  addAuditEntry: (action: string, field?: string, oldValue?: string, newValue?: string) => void;
}

export function useRounding({
  services,
  preferredRoundingServiceId,
  roundingStep,
  isRoundingEnabled,
  addAuditEntry,
}: UseRoundingParams) {
  
  /** Find the best-matching service for a given rounding amount. */
  const findRoundingService = useCallback((roundingAmount: number): { service: ServiceCatalog | null; quantity: number } => {
    if (services.length === 0 || roundingAmount <= 0) {
      return { service: null, quantity: 1 };
    }

    // Check preferred service first
    if (preferredRoundingServiceId) {
      const preferred = services.find(s => s.id === preferredRoundingServiceId);
      if (preferred && preferred.default_price > 0) {
        if (roundingAmount === preferred.default_price) return { service: preferred, quantity: 1 };
        if (roundingAmount % preferred.default_price === 0) return { service: preferred, quantity: Math.floor(roundingAmount / preferred.default_price) };
        if (roundingAmount >= preferred.default_price) return { service: preferred, quantity: Math.floor(roundingAmount / preferred.default_price) };
      }
    }

    // Priority-based fallback
    const priorityOrder = ['Оформление документов', 'Ксерокопия документов', 'Консультация'];
    const sorted = [...services].sort((a, b) => {
      const ai = priorityOrder.indexOf(a.name);
      const bi = priorityOrder.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const svc of sorted) {
      if (svc.default_price > 0 && roundingAmount >= svc.default_price) {
        if (roundingAmount === svc.default_price) return { service: svc, quantity: 1 };
        if (roundingAmount % svc.default_price === 0) return { service: svc, quantity: Math.floor(roundingAmount / svc.default_price) };
      }
    }

    // Best-fit among smaller services
    const small = sorted.filter(s => s.default_price > 0 && s.default_price <= roundingAmount);
    if (small.length > 0) {
      const best = small.reduce((b, c) => (roundingAmount - c.default_price < roundingAmount - b.default_price ? c : b));
      return { service: best, quantity: 1 };
    }

    const flexible = sorted.find(s => s.name === 'Консультация' || s.default_price === 0);
    return { service: flexible || null, quantity: 1 };
  }, [services, preferredRoundingServiceId]);

  /** Build a rounding SaleItemRow if needed. */
  const buildRoundingItem = useCallback((subtotal: number, existingId?: string): SaleItemRow | null => {
    if (subtotal <= 0) return null;
    const calculatedRounding = Math.ceil(subtotal / roundingStep) * roundingStep - subtotal;
    if (calculatedRounding <= 0) return null;

    const { service, quantity } = findRoundingService(calculatedRounding);
    return {
      id: existingId || `rounding-${Date.now()}`,
      type: 'rounding',
      serviceName: service ? service.name : 'Округление (без сдачи)',
      premiumAmount: calculatedRounding,
      quantity,
      unitPrice: service ? service.default_price : calculatedRounding,
    };
  }, [roundingStep, findRoundingService]);

  /** Handle items change with auto-rounding recalculation. */
  const handleItemsChange = useCallback((newItems: SaleItemRow[], setItems: React.Dispatch<React.SetStateAction<SaleItemRow[]>>) => {
    if (isRoundingEnabled) {
      const itemsWithoutRounding = newItems.filter(item => item.type !== 'rounding');
      const subtotal = itemsWithoutRounding.reduce((sum, item) => sum + item.premiumAmount, 0);
      const roundingItem = buildRoundingItem(subtotal);
      setItems(roundingItem ? [...itemsWithoutRounding, roundingItem] : itemsWithoutRounding);
    } else {
      setItems(newItems.filter(item => item.type !== 'rounding'));
    }
  }, [isRoundingEnabled, buildRoundingItem]);

  /** Toggle rounding on/off, updating items accordingly. */
  const handleToggleRounding = useCallback((
    enabled: boolean,
    _roundingAmount: number,
    setIsRoundingEnabled: React.Dispatch<React.SetStateAction<boolean>>,
    setItems: React.Dispatch<React.SetStateAction<SaleItemRow[]>>,
  ) => {
    setIsRoundingEnabled(enabled);

    setItems(prevItems => {
      const itemsWithoutRounding = prevItems.filter(item => item.type !== 'rounding');

      if (enabled) {
        const subtotal = itemsWithoutRounding.reduce((sum, item) => sum + item.premiumAmount, 0);
        const roundingItem = buildRoundingItem(subtotal);

        if (roundingItem) {
          const { service, quantity } = findRoundingService(roundingItem.premiumAmount);
          const label = service
            ? `${service.name} (${quantity > 1 ? `${quantity}×` : ''}${roundingItem.premiumAmount.toFixed(0)} ₽)`
            : `+${roundingItem.premiumAmount.toFixed(0)} ₽`;
          addAuditEntry('Округление включено', 'Услуга', undefined, label);
          return [...itemsWithoutRounding, roundingItem];
        }
        return itemsWithoutRounding;
      } else {
        if (prevItems.some(item => item.type === 'rounding')) {
          addAuditEntry('Округление отключено');
        }
        return itemsWithoutRounding;
      }
    });
  }, [buildRoundingItem, findRoundingService, addAuditEntry]);

  return { findRoundingService, buildRoundingItem, handleItemsChange, handleToggleRounding };
}
