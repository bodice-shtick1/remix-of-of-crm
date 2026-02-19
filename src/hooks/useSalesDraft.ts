import { useEffect, useCallback, useRef } from 'react';
import { ClientData } from '@/components/sales/ClientSearchField';
import { SaleItemRow } from '@/components/sales/SaleItemsTableInline';
import { PaymentMethodType } from '@/components/sales/FinanceModuleEnhanced';
import { DetailedDebtRecord } from '@/hooks/useClientDebtDetails';
import { AuditLogEntry } from '@/types/crm';

const DRAFT_STORAGE_KEY = 'sales-draft';
const SAVE_DEBOUNCE_MS = 500;

export interface SalesDraftData {
  uid: string;
  createdAt: string;
  selectedClient: ClientData | null;
  items: SaleItemRow[];
  paymentMethod: PaymentMethodType;
  isRoundingEnabled: boolean;
  selectedBankId: string;
  installmentDueDate: string;
  installmentPaymentsCount: number;
  selectedDebts: DetailedDebtRecord[];
  auditLog: AuditLogEntry[];
  savedAt: string;
}

export function useSalesDraft(options: {
  uid: string;
  createdAt: Date;
  selectedClient: ClientData | null;
  items: SaleItemRow[];
  paymentMethod: PaymentMethodType;
  isRoundingEnabled: boolean;
  selectedBankId: string;
  installmentDueDate: string;
  installmentPaymentsCount: number;
  selectedDebts: DetailedDebtRecord[];
  auditLog: AuditLogEntry[];
  // Setters for restoring
  setUid: (uid: string) => void;
  setCreatedAt: (date: Date) => void;
  setSelectedClient: (client: ClientData | null) => void;
  setItems: (items: SaleItemRow[]) => void;
  setPaymentMethod: (method: PaymentMethodType) => void;
  setIsRoundingEnabled: (enabled: boolean) => void;
  setSelectedBankId: (id: string) => void;
  setInstallmentDueDate: (date: string) => void;
  setInstallmentPaymentsCount: (count: number) => void;
  setSelectedDebts: (debts: DetailedDebtRecord[]) => void;
  setAuditLog: (log: AuditLogEntry[]) => void;
  isEnabled?: boolean;
}) {
  const {
    uid, createdAt, selectedClient, items, paymentMethod,
    isRoundingEnabled, selectedBankId, installmentDueDate,
    installmentPaymentsCount, selectedDebts, auditLog,
    setUid, setCreatedAt, setSelectedClient, setItems,
    setPaymentMethod, setIsRoundingEnabled, setSelectedBankId,
    setInstallmentDueDate, setInstallmentPaymentsCount,
    setSelectedDebts, setAuditLog,
    isEnabled = true,
  } = options;

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredRef = useRef(false);

  // Save draft to sessionStorage with debounce
  const saveDraft = useCallback(() => {
    if (!isEnabled) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      const draft: SalesDraftData = {
        uid,
        createdAt: createdAt.toISOString(),
        selectedClient,
        items,
        paymentMethod,
        isRoundingEnabled,
        selectedBankId,
        installmentDueDate,
        installmentPaymentsCount,
        selectedDebts,
        auditLog,
        savedAt: new Date().toISOString(),
      };

      try {
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.warn('[SalesDraft] Failed to save draft:', e);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [
    uid, createdAt, selectedClient, items, paymentMethod,
    isRoundingEnabled, selectedBankId, installmentDueDate,
    installmentPaymentsCount, selectedDebts, auditLog, isEnabled,
  ]);

  // Auto-save when data changes
  useEffect(() => {
    if (hasRestoredRef.current) {
      saveDraft();
    }
  }, [saveDraft]);

  // Restore draft on mount
  useEffect(() => {
    if (!isEnabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return;

      const draft: SalesDraftData = JSON.parse(saved);
      
      // Check if draft is not too old (1 hour max)
      const savedAt = new Date(draft.savedAt);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (savedAt < hourAgo) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }

      // Restore all fields
      if (draft.uid) setUid(draft.uid);
      if (draft.createdAt) setCreatedAt(new Date(draft.createdAt));
      if (draft.selectedClient) setSelectedClient(draft.selectedClient);
      if (draft.items?.length) setItems(draft.items);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (typeof draft.isRoundingEnabled === 'boolean') setIsRoundingEnabled(draft.isRoundingEnabled);
      if (draft.selectedBankId) setSelectedBankId(draft.selectedBankId);
      if (draft.installmentDueDate) setInstallmentDueDate(draft.installmentDueDate);
      if (draft.installmentPaymentsCount) setInstallmentPaymentsCount(draft.installmentPaymentsCount);
      if (draft.selectedDebts?.length) setSelectedDebts(draft.selectedDebts);
      if (draft.auditLog?.length) setAuditLog(draft.auditLog);

      console.info('[SalesDraft] Restored draft from', draft.savedAt);
    } catch (e) {
      console.warn('[SalesDraft] Failed to restore draft:', e);
    }
  }, [isEnabled, setUid, setCreatedAt, setSelectedClient, setItems, 
      setPaymentMethod, setIsRoundingEnabled, setSelectedBankId,
      setInstallmentDueDate, setInstallmentPaymentsCount, setSelectedDebts, setAuditLog]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.warn('[SalesDraft] Failed to clear draft:', e);
    }
  }, []);

  // Check if draft exists
  const hasDraft = useCallback(() => {
    try {
      return !!sessionStorage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { saveDraft, clearDraft, hasDraft };
}
