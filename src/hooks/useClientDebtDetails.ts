import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DebtRepaymentItem } from '@/lib/receiptGenerator';

export interface DetailedDebtRecord {
  saleId: string;
  saleUid: string;
  totalAmount: number;
  amountPaid: number;
  remainingDebt: number;
  dueDate: string | null;
  isOverdue: boolean;
  items: {
    id: string;
    itemType: string;
    productName: string;
    policySeries: string | null;
    policyNumber: string | null;
    vehicleBrand: string | null;
    vehicleNumber: string | null;
    startDate: string | null;
    endDate: string | null;
    amount: number;
  }[];
}

export function useClientDebtDetails(clientId: string) {
  return useQuery({
    queryKey: ['client-debt-details', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // Fetch sales with debt
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('id, uid, total_amount, amount_paid, installment_due_date')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .eq('is_installment', true);

      if (salesError) throw salesError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const debtSales = (salesData || []).filter(sale => {
        const totalAmount = Number(sale.total_amount) || 0;
        const amountPaid = Number(sale.amount_paid) || 0;
        return amountPaid < totalAmount;
      });

      if (debtSales.length === 0) return [];

      // Fetch sale items for debt sales
      const saleIds = debtSales.map(s => s.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          id,
          sale_id,
          item_type,
          insurance_product_id,
          policy_series,
          policy_number,
          start_date,
          end_date,
          amount,
          service_name,
          insurance_products:insurance_product_id(name)
        `)
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;

      // Also fetch vehicle info from policies table
      const { data: policiesData } = await supabase
        .from('policies')
        .select('policy_series, policy_number, vehicle_model, vehicle_number')
        .eq('client_id', clientId);

      // Create a map of policy to vehicle info
      const policyVehicleMap = new Map<string, { vehicleBrand: string | null; vehicleNumber: string | null }>();
      policiesData?.forEach(policy => {
        const key = `${policy.policy_series || ''}${policy.policy_number || ''}`.trim();
        if (key) {
          policyVehicleMap.set(key, {
            vehicleBrand: policy.vehicle_model,
            vehicleNumber: policy.vehicle_number,
          });
        }
      });

      // Group items by sale_id
      const itemsBySale: Record<string, typeof itemsData> = {};
      itemsData?.forEach(item => {
        if (!itemsBySale[item.sale_id]) {
          itemsBySale[item.sale_id] = [];
        }
        itemsBySale[item.sale_id].push(item);
      });

      // Build detailed debt records
      const detailedDebts: DetailedDebtRecord[] = debtSales.map(sale => {
        const totalAmount = Number(sale.total_amount) || 0;
        const amountPaid = Number(sale.amount_paid) || 0;
        const dueDate = sale.installment_due_date;
        
        let isOverdue = false;
        if (dueDate) {
          const dueDateObj = new Date(dueDate);
          dueDateObj.setHours(0, 0, 0, 0);
          isOverdue = dueDateObj <= today;
        }

        const saleItems = itemsBySale[sale.id] || [];

        return {
          saleId: sale.id,
          saleUid: sale.uid,
          totalAmount,
          amountPaid,
          remainingDebt: totalAmount - amountPaid,
          dueDate,
          isOverdue,
          items: saleItems.map(item => {
            const policyKey = `${item.policy_series || ''}${item.policy_number || ''}`.trim();
            const vehicleInfo = policyVehicleMap.get(policyKey);
            
            return {
              id: item.id,
              itemType: item.item_type,
              productName: item.item_type === 'insurance' 
                ? ((item.insurance_products as any)?.name || 'Страховка')
                : (item.service_name || 'Услуга'),
              policySeries: item.policy_series,
              policyNumber: item.policy_number,
              vehicleBrand: vehicleInfo?.vehicleBrand || null,
              vehicleNumber: vehicleInfo?.vehicleNumber || null,
              startDate: item.start_date,
              endDate: item.end_date,
              amount: Number(item.amount) || 0,
            };
          }),
        };
      });

      return detailedDebts;
    },
    enabled: !!clientId,
  });
}

// Helper to convert debt records to print format
export function convertDebtsToRepaymentItems(
  debts: DetailedDebtRecord[],
  selectedSaleIds: string[]
): DebtRepaymentItem[] {
  const items: DebtRepaymentItem[] = [];
  
  debts
    .filter(debt => selectedSaleIds.includes(debt.saleId))
    .forEach(debt => {
      // If the debt sale has insurance items, add each one
      const insuranceItems = debt.items.filter(i => i.itemType === 'insurance');
      
      if (insuranceItems.length > 0) {
        insuranceItems.forEach(item => {
          items.push({
            id: item.id,
            saleId: debt.saleId,
            productName: item.productName,
            policySeries: item.policySeries || undefined,
            policyNumber: item.policyNumber || undefined,
            vehicleBrand: item.vehicleBrand || undefined,
            vehicleNumber: item.vehicleNumber || undefined,
            startDate: item.startDate || undefined,
            endDate: item.endDate || undefined,
            amount: debt.remainingDebt / insuranceItems.length, // Split debt proportionally
          });
        });
      } else {
        // For service-only debts, create a single item
        items.push({
          id: debt.saleId,
          saleId: debt.saleId,
          productName: debt.items[0]?.productName || 'Услуга',
          amount: debt.remainingDebt,
        });
      }
    });
  
  return items;
}
