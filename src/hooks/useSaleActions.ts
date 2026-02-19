import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClientData } from '@/components/sales/ClientSearchField';
import { SaleItemRow, InsuranceProductCatalog } from '@/components/sales/SaleItemsTableInline';
import { PaymentMethodType } from '@/components/sales/FinanceModuleEnhanced';
import { AuditLogEntry } from '@/types/crm';
import { generateCashReceiptPDF, generateCommodityReceiptPDF, DebtRepaymentItem } from '@/lib/receiptGenerator';
import { DetailedDebtRecord, convertDebtsToRepaymentItems } from '@/hooks/useClientDebtDetails';
import { format, addYears, subDays } from 'date-fns';
import { useVehicleRegistry } from '@/hooks/useVehicleRegistry';
import { logEventDirect } from '@/hooks/useEventLog';
import { saveDocumentArchive } from '@/hooks/useDocumentArchives';

function generateUID() {
  const year = new Date().getFullYear();
  const uuid = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${year}-INV-${uuid}`;
}

export { generateUID };

// --------------- helpers ---------------

import { getClientDisplayName } from '@/lib/mappers';
export { getClientDisplayName };

function getDebtRepaymentItems(debts: DetailedDebtRecord[]): DebtRepaymentItem[] {
  if (debts.length === 0) return [];
  return convertDebtsToRepaymentItems(debts, debts.map(d => d.saleId));
}

// --------------- validation ---------------

export function validateSale(
  selectedClient: ClientData | null,
  items: SaleItemRow[],
): string | null {
  if (!selectedClient) return 'Выберите клиента';

  const validItems = items.filter(item => item.type !== 'rounding');
  if (validItems.length === 0) return 'Добавьте хотя бы одну позицию';

  for (const item of validItems) {
    if (item.type === 'insurance') {
      if (!item.insuranceCompany) return 'Укажите страховую компанию для всех полисов';
      if (!item.number) return 'Укажите номер полиса для всех страховок';
      if (item.premiumAmount <= 0) return 'Укажите премию для всех страховок';
    }
    if (item.type === 'service') {
      if (!item.serviceName) return 'Выберите услугу';
      if (item.premiumAmount <= 0) return 'Укажите стоимость услуги';
    }
  }
  return null;
}

// --------------- hook ---------------

interface UseSaleActionsParams {
  selectedClient: ClientData | null;
  items: SaleItemRow[];
  paymentMethod: PaymentMethodType;
  selectedBankId: string;
  installmentDueDate: string;
  installmentPaymentsCount: number;
  uid: string;
  createdAt: Date;
  auditLog: AuditLogEntry[];
  addAuditEntry: (action: string, field?: string, oldValue?: string, newValue?: string) => void;
  selectedDebts: DetailedDebtRecord[];
  insuranceProducts: InsuranceProductCatalog[];
  lastOsagoSeries: string;
  setLastOsagoSeries: (series: string) => void;
  roundingAmount: number;
  // reset helpers for "save & next"
  resetSale: () => void;
  focusClientSearch: () => void;
  // document form data getter
  getDocumentFormData?: () => { type: string; data: Record<string, any> } | null;
  getDocumentClientUpdates?: () => Record<string, any> | null;
  validateDkpFields?: () => string[];
}

export function useSaleActions({
  selectedClient,
  items,
  paymentMethod,
  selectedBankId,
  installmentDueDate,
  installmentPaymentsCount,
  uid,
  createdAt,
  auditLog,
  addAuditEntry,
  selectedDebts,
  insuranceProducts,
  lastOsagoSeries,
  setLastOsagoSeries,
  roundingAmount,
  resetSale,
  focusClientSearch,
  getDocumentFormData,
  getDocumentClientUpdates,
  validateDkpFields,
}: UseSaleActionsParams) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { upsertVehicle } = useVehicleRegistry();

  // ---- totals ----
  const calculateTotal = useCallback(() => {
    // Sum of all non-rounding items + rounding amount
    const itemsSum = items
      .filter(item => item.type !== 'rounding')
      .reduce((sum, item) => sum + item.premiumAmount, 0);
    return itemsSum + roundingAmount;
  }, [items, roundingAmount]);

  const selectedDebtsTotal = selectedDebts.reduce((sum, d) => sum + d.remainingDebt, 0);

  const calculateTotalWithDebts = useCallback(() => {
    return calculateTotal() + selectedDebtsTotal;
  }, [calculateTotal, selectedDebtsTotal]);

  // ---- print ----
  const handlePrintCashReceipt = useCallback(() => {
    if (!selectedClient) return;
    generateCashReceiptPDF({
      uid,
      date: createdAt,
      clientName: getClientDisplayName(selectedClient),
      clientPhone: selectedClient.phone,
      items,
      total: calculateTotalWithDebts(),
      paymentMethod,
      agentName: user?.email || 'Агент',
      roundingAmount: Number(roundingAmount),
      debtRepayments: getDebtRepaymentItems(selectedDebts),
    });
    logEventDirect({
      action: 'print',
      category: 'sales',
      entityType: 'receipt',
      clientId: selectedClient.id,
      fieldAccessed: `Кассовый чек ${uid}`,
    });
  }, [selectedClient, items, uid, createdAt, paymentMethod, user, selectedDebts, calculateTotalWithDebts, roundingAmount]);

  const handlePrintCommodityReceipt = useCallback(() => {
    if (!selectedClient) return;
    generateCommodityReceiptPDF({
      uid,
      date: createdAt,
      clientName: getClientDisplayName(selectedClient),
      clientPhone: selectedClient.phone,
      items,
      total: calculateTotalWithDebts(),
      paymentMethod,
      agentName: user?.email || 'Агент',
      roundingAmount: Number(roundingAmount),
      debtRepayments: getDebtRepaymentItems(selectedDebts),
    });
  }, [selectedClient, items, uid, createdAt, paymentMethod, user, selectedDebts, calculateTotalWithDebts, roundingAmount]);

  // ---- save ----
  const saveSale = useCallback(async (andNext: boolean = false) => {
    const validationError = validateSale(selectedClient, items);
    if (validationError) {
      toast({ title: 'Ошибка', description: validationError, variant: 'destructive' });
      return;
    }

    // Validate DKP required fields if DKP service is selected
    if (validateDkpFields) {
      const missing = validateDkpFields();
      if (missing.length > 0) {
        toast({
          title: 'Заполните обязательные поля ДКП',
          description: missing.join(', '),
          variant: 'destructive',
        });
        return;
      }
    }

    if (!user || !selectedClient) return;

    try {
      const total = calculateTotal();
      const roundingValue = Number(roundingAmount);
      const firstInsuranceItem = items.find(i => i.type === 'insurance');
      const saleCompanyId = firstInsuranceItem?.insuranceCompanyId || null;
      const saleContractId = firstInsuranceItem?.insuranceContractId || null;

      console.log('[SaveSale] total_amount:', total, 'rounding_amount:', roundingValue, 'items count:', items.length);

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          uid,
          client_id: selectedClient.id,
          total_amount: Number(total),
          payment_method: paymentMethod,
          bank_id: paymentMethod === 'transfer' ? selectedBankId || null : null,
          is_installment: paymentMethod === 'debt',
          installment_due_date: paymentMethod === 'debt' ? installmentDueDate || null : null,
          installment_payments_count: paymentMethod === 'debt' ? installmentPaymentsCount : null,
          rounding_amount: roundingValue,
          status: 'completed',
          created_by: user.id,
          completed_at: new Date().toISOString(),
          company_id: saleCompanyId,
          contract_id: saleContractId,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Sale items
      const saleItemsToInsert = items
        .filter(item => item.type !== 'rounding')
        .map(item => ({
          sale_id: sale.id,
          item_type: item.type,
          insurance_product_id: item.type === 'insurance' ? item.productId : null,
          policy_series: item.type === 'insurance' ? item.series : null,
          policy_number: item.type === 'insurance' ? item.number : null,
          insurance_company: item.type === 'insurance' ? item.insuranceCompany : null,
          start_date: item.type === 'insurance' ? item.startDate : null,
          end_date: item.type === 'insurance' ? item.endDate : null,
          premium_amount: item.type === 'insurance' ? item.premiumAmount : null,
          commission_percent: item.type === 'insurance' ? item.commissionPercent : null,
          commission_amount: item.type === 'insurance' ? item.premiumAmount * (item.commissionPercent || 15) / 100 : null,
          service_name: item.type === 'service' ? item.serviceName : null,
          quantity: item.type === 'service' ? item.quantity || 1 : null,
          unit_price: item.type === 'service' ? item.unitPrice : null,
          amount: item.premiumAmount,
        }));
      const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsToInsert);
      if (itemsError) throw itemsError;

      // Policies
      const insuranceItems = items.filter(item => item.type === 'insurance');
      if (insuranceItems.length > 0) {
        const policiesToInsert = insuranceItems.map(item => ({
          client_id: selectedClient.id,
          insurance_product_id: item.productId,
          policy_type: item.productName,
          policy_series: item.series,
          policy_number: item.series && item.number ? `${item.series} ${item.number}` : `${Date.now()}`,
          insurance_company: item.insuranceCompany || 'Не указана',
          start_date: item.startDate,
          end_date: item.endDate,
          premium_amount: item.premiumAmount,
          commission_percent: item.commissionPercent || 15,
          commission_amount: item.premiumAmount * (item.commissionPercent || 15) / 100,
          status: 'active',
          payment_status: paymentMethod === 'debt' ? 'pending' : 'paid',
          agent_id: user.id,
          vehicle_model: item.vehicleBrand || null,
          vehicle_number: item.vehicleNumber || null,
        }));
        const { error: policiesError } = await supabase.from('policies').insert(policiesToInsert);
        if (policiesError) console.error('Error creating policies:', policiesError);
        
        // Save vehicles to catalog and registry for future auto-fill
        for (const item of insuranceItems) {
          if (item.vehicleBrand) {
            // Save to vehicle_registry
            await upsertVehicle({
              plateNumber: item.vehicleNumber,
              vinCode: item.vinCode,
              brandName: item.vehicleBrand,
              modelName: item.vehicleModel,
              customerId: selectedClient.id,
            });
            
          }
        }
      }

      // Update OSAGO series
      const osagoItem = items.find(item => item.productName === 'ОСАГО' && item.series);
      if (osagoItem?.series) {
        await supabase
          .from('agent_settings')
          .upsert({ user_id: user.id, last_osago_series: osagoItem.series }, { onConflict: 'user_id' });
        setLastOsagoSeries(osagoItem.series);
      }

      // Audit log
      for (const entry of auditLog) {
        await supabase.from('sale_audit_log').insert({
          sale_id: sale.id,
          user_id: user.id,
          user_name: entry.userName,
          action: entry.action,
          field: entry.field,
          old_value: entry.oldValue,
          new_value: entry.newValue,
        });
      }

      // Mark debts as paid
      if (selectedDebts.length > 0) {
        for (const debt of selectedDebts) {
          await supabase
            .from('sales')
            .update({ amount_paid: debt.totalAmount, debt_status: 'paid' })
            .eq('id', debt.saleId);
        }
        addAuditEntry('Долги погашены', 'Сумма', undefined,
          `${selectedDebts.reduce((sum, d) => sum + d.remainingDebt, 0).toLocaleString('ru-RU')} ₽`);
      }

      addAuditEntry('Документ проведен', 'Статус', 'Черновик', 'Завершен');

      // Save document form data (DKP / Europrotocol) linked to this sale
      if (getDocumentFormData) {
        try {
          const docFormData = getDocumentFormData();
          if (docFormData && selectedClient) {
            const docType = docFormData.type === 'dkp' ? 'contract' : 'europrotocol';
            const prefix = docFormData.type === 'dkp' ? 'dkp' : 'europrotocol';
            const fileName = `${prefix}_${Date.now()}.json`;

            await supabase.from('client_documents').insert({
              client_id: selectedClient.id,
              sale_id: sale.id,
              file_name: fileName,
              file_path: `documents/${fileName}`,
              document_type: docType,
              mime_type: 'application/json',
              metadata: docFormData.data,
              uploaded_by: user.id,
            });
          }
        } catch (docErr) {
          console.error('Error saving document form data:', docErr);
        }
      }

      // Save receipt snapshots to document_archives (both cash and sales receipts)
      try {
        const receiptBaseData: Record<string, any> = {
          uid,
          date: createdAt.toISOString(),
          clientName: getClientDisplayName(selectedClient),
          clientPhone: selectedClient.phone,
          items: items.filter(i => i.type !== 'rounding').map(i => ({
            type: i.type,
            productName: i.productName,
            serviceName: i.serviceName,
            series: i.series,
            number: i.number,
            vehicleBrand: i.vehicleBrand,
            vehicleNumber: i.vehicleNumber,
            startDate: i.startDate,
            endDate: i.endDate,
            premiumAmount: i.premiumAmount,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          total: calculateTotal(),
          paymentMethod,
          agentName: user?.email || 'Агент',
          roundingAmount,
        };

        // Save cash receipt (80mm tape)
        await saveDocumentArchive({
          clientId: selectedClient.id,
          type: 'cash_receipt',
          documentData: receiptBaseData,
          userId: user.id,
        });

        // Save sales receipt (A4 formal)
        await saveDocumentArchive({
          clientId: selectedClient.id,
          type: 'sales_receipt',
          documentData: receiptBaseData,
          userId: user.id,
        });
      } catch (receiptErr) {
        console.error('Error saving receipt snapshots:', receiptErr);
      }

      let clientDataUpdated = false;
      if (getDocumentClientUpdates && selectedClient) {
        try {
          const clientUpdates = getDocumentClientUpdates();
          if (clientUpdates && Object.keys(clientUpdates).length > 0) {
            const { error: updateClientErr } = await supabase
              .from('clients')
              .update(clientUpdates)
              .eq('id', selectedClient.id);
            if (updateClientErr) {
              console.error('Error writing back client data:', updateClientErr);
            } else {
              clientDataUpdated = true;
              console.log('[SaveSale] Client data updated from DKP form:', Object.keys(clientUpdates));
              queryClient.invalidateQueries({ queryKey: ['dkp-client', selectedClient.id] });
            }
          }
        } catch (updateErr) {
          console.error('Error writing back client data:', updateErr);
        }
      }

      // Log event
      logEventDirect({
        action: 'create',
        category: 'sales',
        entityType: 'sale',
        entityId: sale.id,
        clientId: selectedClient.id,
        fieldAccessed: `Продажа ${uid}`,
        newValue: `${total.toLocaleString('ru-RU')} ₽`,
        details: { items: items.length, paymentMethod, roundingAmount },
      });

      const debtsTotal = selectedDebts.reduce((sum, d) => sum + d.remainingDebt, 0);
      const clientNote = clientDataUpdated ? '. Данные клиента обновлены' : '';
      toast({
        title: 'Продажа оформлена',
        description: `Документ ${uid} на сумму ${(total + debtsTotal).toLocaleString('ru-RU')} ₽ успешно проведен${debtsTotal > 0 ? ` (включая погашение долга ${debtsTotal.toLocaleString('ru-RU')} ₽)` : ''}${clientNote}`,
      });

      // Refresh dashboard stats & shift data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shift-management'] });

      if (andNext) {
        resetSale();
        setTimeout(() => focusClientSearch(), 100);
      }
    } catch (error) {
      console.error('Error saving sale:', error);
      toast({ title: 'Ошибка', description: 'Не удалось сохранить продажу', variant: 'destructive' });
    }
  }, [
    selectedClient, items, paymentMethod, selectedBankId, installmentDueDate,
    installmentPaymentsCount, uid, auditLog, addAuditEntry, selectedDebts,
    user, toast, calculateTotal, setLastOsagoSeries, resetSale, focusClientSearch,
    roundingAmount, getDocumentFormData, getDocumentClientUpdates, validateDkpFields,
  ]);

  // ---- client creation ----
  const handleCreateClient = useCallback(async (
    data: Partial<ClientData>,
    setClients: React.Dispatch<React.SetStateAction<ClientData[]>>,
    setSelectedClient: React.Dispatch<React.SetStateAction<ClientData | null>>,
    onClientCreated: () => void,
  ) => {
    if (!user) return;
    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          middle_name: data.middle_name,
          is_company: false,
          phone: data.phone || '',
          birth_date: data.birth_date || null,
          address: data.address,
          agent_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setClients(prev => [...prev, newClient]);
      setSelectedClient(newClient);
      addAuditEntry('Новый клиент создан', 'Клиент', undefined, `${newClient.last_name} ${newClient.first_name}`);
      toast({ title: 'Клиент создан', description: `${newClient.last_name} ${newClient.first_name} добавлен в базу` });
      onClientCreated();
    } catch (error) {
      console.error('Error creating client:', error);
      toast({ title: 'Ошибка', description: 'Не удалось создать клиента', variant: 'destructive' });
    }
  }, [user, addAuditEntry, toast]);

  // ---- add default first product row ----
  const addFirstProduct = useCallback((
    currentItems: SaleItemRow[],
    setItems: React.Dispatch<React.SetStateAction<SaleItemRow[]>>,
    insuranceProducts: InsuranceProductCatalog[],
    lastOsagoSeries: string,
  ) => {
    if (currentItems.length > 0) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(subDays(addYears(new Date(), 1), 1), 'yyyy-MM-dd');
    const defaultProduct = insuranceProducts.find(p => p.code === 'OSAGO');

    setItems([{
      id: `item-${Date.now()}`,
      type: 'insurance',
      productId: defaultProduct?.id,
      productName: defaultProduct?.name || 'ОСАГО',
      series: lastOsagoSeries || defaultProduct?.default_series || '',
      number: '',
      insuranceCompany: '',
      startDate: today,
      endDate,
      premiumAmount: 0,
      commissionPercent: defaultProduct?.default_commission_percent || 15,
    }]);
  }, []);

  return {
    calculateTotal,
    calculateTotalWithDebts,
    selectedDebtsTotal,
    handlePrintCashReceipt,
    handlePrintCommodityReceipt,
    saveSale,
    handleCreateClient,
    addFirstProduct,
  };
}
