import { useState, useRef, useCallback, memo, forwardRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SaleHeaderCompact } from '@/components/sales/SaleHeaderCompact';
import { ClientSearchField, ClientData, ClientSearchFieldRef } from '@/components/sales/ClientSearchField';
import { InsuranceProductsTable, InsuranceItemRow, InsuranceProductsTableRef } from '@/components/sales/InsuranceProductsTable';
import { ServicesTable, ServiceItemRow, ServicesTableRef, ServiceCatalog } from '@/components/sales/ServicesTable';
import { ProductServiceLink } from '@/components/sales/SaleItemsTableInline';
import { FinanceModuleEnhanced, PaymentMethodType, FinanceModuleEnhancedRef } from '@/components/sales/FinanceModuleEnhanced';
import { DebtIncludeCheckbox } from '@/components/sales/DebtIncludeCheckbox';
import { AuditLogEntry } from '@/types/crm';
import { useAuth } from '@/hooks/useAuth';
import { useShiftManagement } from '@/hooks/useShiftManagement';
import { useSaleData } from '@/hooks/useSaleData';
import { useRounding } from '@/hooks/useRounding';
import { useSaleActions, generateUID } from '@/hooks/useSaleActions';
import { useSalesDraft } from '@/hooks/useSalesDraft';
import { DetailedDebtRecord } from '@/hooks/useClientDebtDetails';
import { Loader2, Lock, CreditCard, Banknote, QrCode, Check, Building2, CalendarClock, Printer, Receipt, X, FileText, User, Shield, Wrench } from 'lucide-react';
import { printPndConsent, markPndSigned } from '@/lib/pndConsentGenerator';
import { saveDocumentArchive } from '@/hooks/useDocumentArchives';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { SaleItemRow } from '@/components/sales/SaleItemsTableInline';
import { DocumentFormPanel, DocumentFormPanelRef } from '@/components/sales/DocumentFormPanel';
import { usePermissions } from '@/hooks/usePermissions';
function Sales() {
  const navigate = useNavigate();
  const { user, userRole, isLoading: authLoading } = useAuth();
  const { can } = usePermissions();
  const { isShiftOpen, isLoading: isShiftLoading, openShift, getExpectedOpeningBalance } = useShiftManagement();
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  // ---- local state ----
  const [uid, setUid] = useState(() => generateUID());
  const [createdAt, setCreatedAt] = useState(() => new Date());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([
    { id: '1', userId: '1', userName: 'Система', action: 'Документ создан', timestamp: new Date().toISOString() },
  ]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [insuranceItems, setInsuranceItems] = useState<InsuranceItemRow[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItemRow[]>([]);
  const [localServices, setLocalServices] = useState<ServiceCatalog[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [isRoundingEnabled, setIsRoundingEnabled] = useState(true);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [installmentDueDate, setInstallmentDueDate] = useState('');
  const [installmentPaymentsCount, setInstallmentPaymentsCount] = useState(1);
  const [selectedDebts, setSelectedDebts] = useState<DetailedDebtRecord[]>([]);

  // ---- refs ----
  const clientSearchRef = useRef<ClientSearchFieldRef>(null);
  const insuranceTableRef = useRef<InsuranceProductsTableRef>(null);
  const servicesTableRef = useRef<ServicesTableRef>(null);
  const financeModuleRef = useRef<FinanceModuleEnhancedRef>(null);
  const documentFormRef = useRef<DocumentFormPanelRef>(null);

  const showCommission = userRole === 'admin';

  // ---- data hook (must be before items memo) ----
  const saleData = useSaleData();
  const { org } = useOrganization();

  // Sync local services with saleData.services
  useEffect(() => {
    setLocalServices(saleData.services as ServiceCatalog[]);
  }, [saleData.services]);

  // ---- Reconcile auto-linked services when insurance items change ----
  const prevInsuranceItemsRef = useRef<string>('');
  useEffect(() => {
    // Serialize product IDs to detect meaningful changes
    const currentKey = insuranceItems.map(i => i.productId || '').sort().join(',');
    if (currentKey === prevInsuranceItemsRef.current) return;
    prevInsuranceItemsRef.current = currentKey;

    const links = saleData.productServiceLinks as ProductServiceLink[];
    if (!links.length || !localServices.length) return;

    // Count products by ID
    const productCounts: Record<string, number> = {};
    insuranceItems.forEach(item => {
      if (item.productId) {
        productCounts[item.productId] = (productCounts[item.productId] || 0) + 1;
      }
    });

    // Build expected auto-service map: serviceId -> { quantity, price, name, isDeletionProhibited }
    const expectedAuto: Record<string, { quantity: number; price: number; name: string; isDeletionProhibited: boolean }> = {};
    Object.entries(productCounts).forEach(([productId, count]) => {
      links
        .filter(l => l.product_id === productId && l.inclusion_type === 'auto')
        .forEach(link => {
          const svc = localServices.find(s => s.id === link.service_id);
          if (!svc) return;
          if (expectedAuto[link.service_id]) {
            expectedAuto[link.service_id].quantity += count;
          } else {
            expectedAuto[link.service_id] = {
              quantity: count,
              price: svc.default_price,
              name: svc.name,
              isDeletionProhibited: link.is_deletion_prohibited,
            };
          }
        });
    });

    setServiceItems(prev => {
      const result: ServiceItemRow[] = [];
      const processedIds = new Set<string>();

      // 1. Keep existing items, update auto-linked quantities
      prev.forEach(item => {
        if (item.isAutoLinked && item.serviceId) {
          const expected = expectedAuto[item.serviceId];
          if (expected) {
            // Still needed
            const newQty = item.manualQuantityOverride ? item.quantity : expected.quantity;
            result.push({
              ...item,
              quantity: newQty,
              autoQuantity: expected.quantity,
              totalAmount: newQty * item.unitPrice,
              isDeletionProhibited: expected.isDeletionProhibited,
            });
            processedIds.add(item.serviceId);
          }
          // else: no longer needed, drop it
        } else {
          // Manual item - keep as is
          result.push(item);
        }
      });

      // 2. Add new auto-linked services
      Object.entries(expectedAuto).forEach(([serviceId, info]) => {
        if (!processedIds.has(serviceId)) {
          result.push({
            id: `srv-auto-${serviceId}-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
            serviceId,
            serviceName: info.name,
            quantity: info.quantity,
            unitPrice: info.price,
            totalAmount: info.quantity * info.price,
            isAutoLinked: true,
            autoQuantity: info.quantity,
            isDeletionProhibited: info.isDeletionProhibited,
          });
        }
      });

      return result;
    });
  }, [insuranceItems, saleData.productServiceLinks, localServices]);

  // Convert items to SaleItemRow for legacy hooks
  const items = useMemo((): SaleItemRow[] => {
    const insRows: SaleItemRow[] = insuranceItems.map(i => {
      const product = saleData.insuranceProducts.find(p => p.id === i.productId);
      return {
        id: i.id,
        type: 'insurance' as const,
        productId: i.productId,
        productName: i.productName,
        series: i.series,
        number: i.number,
        numberLength: i.numberLength,
        requiresVehicle: i.requiresVehicle,
        seriesMask: i.seriesMask,
        numberMask: i.numberMask,
        insuranceCompany: i.insuranceCompany,
        insuranceCompanyId: i.insuranceCompanyId,
        insuranceContractId: i.insuranceContractId,
        startDate: i.startDate,
        endDate: i.endDate,
        premiumAmount: i.premiumAmount,
        commissionPercent: i.commissionPercent,
        vehicleBrand: i.vehicleBrand,
        vehicleModel: i.vehicleModel,
        vehicleNumber: i.vehicleNumber,
        vinCode: i.vinCode,
        isRoundable: product?.is_roundable ?? true,
      };
    });
    const srvRows: SaleItemRow[] = serviceItems.map(s => {
      const service = localServices.find(svc => svc.id === s.serviceId);
      return {
        id: s.id,
        type: 'service' as const,
        serviceName: s.serviceName,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        premiumAmount: s.totalAmount,
        isRoundable: service?.is_roundable ?? true,
      };
    });
    return [...insRows, ...srvRows];
  }, [insuranceItems, serviceItems, saleData.insuranceProducts, localServices]);

  // Detect selected document service names for DocumentFormPanel
  const selectedServiceNames = useMemo(() => {
    return serviceItems
      .filter(s => s.serviceName)
      .map(s => s.serviceName);
  }, [serviceItems]);

  // ---- compute rounding amount from current state ----
  const roundableSubtotal = useMemo(() => {
    return items
      .filter(item => item.type !== 'rounding' && item.isRoundable !== false)
      .reduce((sum, item) => sum + item.premiumAmount, 0);
  }, [items]);

  const computedRoundingAmount = useMemo(() => {
    if (!isRoundingEnabled || roundableSubtotal === 0) return 0;
    const step = saleData.agentSettings.roundingStep || 100;
    return Math.ceil(roundableSubtotal / step) * step - roundableSubtotal;
  }, [isRoundingEnabled, roundableSubtotal, saleData.agentSettings.roundingStep]);

  // ---- audit helper ----
  const addAuditEntry = useCallback((action: string, field?: string, oldValue?: string, newValue?: string) => {
    setAuditLog(prev => [...prev, {
      id: `${Date.now()}`,
      userId: user?.id || '1',
      userName: user?.email || 'Агент',
      action, field, oldValue, newValue,
      timestamp: new Date().toISOString(),
    }]);
  }, [user]);

  // ---- draft persistence hook ----
  const draftControls = useSalesDraft({
    uid, createdAt, selectedClient, items, paymentMethod,
    isRoundingEnabled, selectedBankId, installmentDueDate,
    installmentPaymentsCount, selectedDebts, auditLog,
    setUid, setCreatedAt, setSelectedClient,
    setItems: () => {}, // Legacy - not used with new split tables
    setPaymentMethod, setIsRoundingEnabled, setSelectedBankId,
    setInstallmentDueDate, setInstallmentPaymentsCount,
    setSelectedDebts, setAuditLog,
    isEnabled: true,
  });

  // ---- rounding hook ----
  const rounding = useRounding({
    services: saleData.services,
    preferredRoundingServiceId: saleData.agentSettings.preferredRoundingServiceId,
    roundingStep: saleData.agentSettings.roundingStep,
    isRoundingEnabled,
    addAuditEntry,
  });

  // ---- reset helper (for save & next) ----
  const resetSale = useCallback(() => {
    setUid(generateUID());
    setCreatedAt(new Date());
    setSelectedClient(null);
    setInsuranceItems([]);
    setServiceItems([]);
    setPaymentMethod('cash');
    setIsRoundingEnabled(true);
    setSelectedBankId('');
    setInstallmentDueDate('');
    setInstallmentPaymentsCount(1);
    setSelectedDebts([]);
    setAuditLog([{
      id: '1', userId: user?.id || '1', userName: 'Система',
      action: 'Документ создан', timestamp: new Date().toISOString(),
    }]);
    // Clear draft after reset
    draftControls.clearDraft();
  }, [user, draftControls]);

  // ---- actions hook ----
  const getDocumentFormData = useCallback(() => {
    const docType = documentFormRef.current?.getDocumentType();
    const docData = documentFormRef.current?.getDocumentData();
    if (docType && docData) return { type: docType, data: docData };
    return null;
  }, []);

  const getDocumentClientUpdates = useCallback(() => {
    return documentFormRef.current?.getClientUpdates() || null;
  }, []);

  const validateDkpFields = useCallback(() => {
    return documentFormRef.current?.validateDkp() || [];
  }, []);

  const actions = useSaleActions({
    selectedClient, items, paymentMethod, selectedBankId,
    installmentDueDate, installmentPaymentsCount, uid, createdAt,
    auditLog, addAuditEntry, selectedDebts,
    insuranceProducts: saleData.insuranceProducts,
    lastOsagoSeries: saleData.agentSettings.lastOsagoSeries,
    setLastOsagoSeries: saleData.setLastOsagoSeries,
    roundingAmount: computedRoundingAmount,
    resetSale,
    focusClientSearch: () => clientSearchRef.current?.focus(),
    getDocumentFormData,
    getDocumentClientUpdates,
    validateDkpFields,
  });

  // ---- PND consent handler ----
  const handlePrintPndConsent = useCallback(() => {
    if (!selectedClient) return;
    const clientName = selectedClient.is_company
      ? (selectedClient.company_name || '')
      : `${selectedClient.last_name || ''} ${selectedClient.first_name || ''} ${selectedClient.middle_name || ''}`.trim();
    const c = selectedClient as any;
    const consentData = {
      clientName,
      passportSeries: c.passport_series || undefined,
      passportNumber: c.passport_number || undefined,
      passportIssuedBy: c.passport_issued_by || undefined,
      passportIssueDate: c.passport_issue_date || undefined,
      address: selectedClient.address || undefined,
      phone: selectedClient.phone || undefined,
      organizationName: org?.name || 'Организация',
      organizationInn: org?.inn || undefined,
      organizationAddress: org?.address || undefined,
      date: new Date().toISOString().slice(0, 10),
    };
    printPndConsent(consentData);
    markPndSigned(selectedClient.id);

    // Save PND snapshot
    saveDocumentArchive({
      clientId: selectedClient.id,
      type: 'pnd',
      documentData: consentData,
      userId: user?.id,
    });
  }, [selectedClient, org, user]);

  // ---- event handlers ----
  const handleAddFirstInsurance = useCallback(() => {
    insuranceTableRef.current?.addRow();
  }, []);

  const handleSelectClient = useCallback((client: ClientData | null) => {
    if (client && !selectedClient) {
      addAuditEntry('Клиент выбран', 'Клиент', undefined,
        client.is_company ? client.company_name : `${client.last_name} ${client.first_name}`);
      saleData.loadClientHistory(client.id);
      setSelectedClient(client);
      setTimeout(() => handleAddFirstInsurance(), 100);
    } else if (!client) {
      saleData.clearClientHistory();
      setSelectedClient(null);
    } else {
      setSelectedClient(client);
    }
  }, [selectedClient, addAuditEntry, saleData, handleAddFirstInsurance]);

  const handleCreateClient = useCallback(async (data: Partial<ClientData>) => {
    await actions.handleCreateClient(data, saleData.setClients, setSelectedClient, () => {
      setTimeout(() => handleAddFirstInsurance(), 100);
    });
  }, [actions, saleData.setClients, handleAddFirstInsurance]);

  const handleToggleRounding = useCallback((enabled: boolean, roundingAmount: number) => {
    // Rounding is now handled in footer based on totals
    setIsRoundingEnabled(enabled);
  }, []);

  const getActiveContractsForCompany = useCallback((companyId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return saleData.insuranceContracts.filter(c =>
      c.company_id === companyId && c.is_active && c.start_date <= today && c.end_date >= today
    );
  }, [saleData.insuranceContracts]);

  // Track accordion state (must be before early returns)
  const [openAccordions, setOpenAccordions] = useState<string[]>(['client']);

  // Auto-open insurance accordion when client is selected
  useEffect(() => {
    if (selectedClient && !openAccordions.includes('insurance')) {
      setOpenAccordions(prev => [...prev, 'insurance']);
    }
  }, [selectedClient]);

  // Auto-open services accordion when service items exist
  useEffect(() => {
    if (serviceItems.length > 0 && !openAccordions.includes('services')) {
      setOpenAccordions(prev => [...prev, 'services']);
    }
  }, [serviceItems.length]);

  // ---- loading / guard states ----
  if (authLoading || saleData.isLoading || isShiftLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isShiftOpen) {
    const canManageShift = can('dash_shift_manage');

    const handleQuickOpenShift = async () => {
      setIsOpeningShift(true);
      try {
        const expectedBalance = getExpectedOpeningBalance();
        await openShift(expectedBalance, expectedBalance);
      } finally {
        setIsOpeningShift(false);
      }
    };

    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle>Кассовая смена закрыта</AlertTitle>
          <AlertDescription>
            {canManageShift
              ? 'Открыть смену и начать продажу?'
              : 'Смена закрыта. У вас нет прав на открытие смены, обратитесь к администратору.'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-3">
          {canManageShift && (
            <Button onClick={handleQuickOpenShift} disabled={isOpeningShift} className="gap-2">
              {isOpeningShift && <Loader2 className="h-4 w-4 animate-spin" />}
              Открыть смену
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            Перейти на главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b shrink-0">
        <SaleHeaderCompact uid={uid} createdAt={createdAt} auditLog={auditLog} />
      </div>

      {/* Main Content — scrollable area with fixed height */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
        <div className="px-2 py-3 pb-4">
          <Accordion
            type="multiple"
            value={openAccordions}
            onValueChange={setOpenAccordions}
            className="space-y-2"
          >
            {/* ─── 1. Client Block ─── */}
            <AccordionItem value="client" className="card-elevated border rounded-lg overflow-visible">
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 transition-colors [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Основная информация</span>
                  {selectedClient && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">
                      {selectedClient.last_name} {selectedClient.first_name}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-1" overflowVisible>
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground mb-1">Enter — парсинг ФИО+телефон</div>
                  <ClientSearchField
                    ref={clientSearchRef}
                    clients={saleData.clients}
                    selectedClient={selectedClient}
                    onSelectClient={handleSelectClient}
                    onCreateClient={handleCreateClient}
                    clientVisits={saleData.clientVisits}
                    expiringPolicies={saleData.expiringPolicies}
                    isLoadingHistory={saleData.isLoadingHistory}
                  />
                  <DebtIncludeCheckbox
                    clientId={selectedClient?.id || null}
                    onDebtSelectionChange={setSelectedDebts}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ─── 2. Insurance Products ─── */}
            <AccordionItem value="insurance" className="card-elevated border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 transition-colors [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Страховые продукты</span>
                  {insuranceItems.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">
                      {insuranceItems.length} шт.
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2 pt-1">
                <InsuranceProductsTable
                  ref={insuranceTableRef}
                  items={insuranceItems}
                  onItemsChange={setInsuranceItems}
                  insuranceProducts={saleData.insuranceProducts}
                  insuranceCompanies={saleData.insuranceCompanies}
                  insuranceContracts={saleData.insuranceContracts}
                  lastOsagoSeries={saleData.agentSettings.lastOsagoSeries}
                  showCommission={showCommission}
                  onPremiumEntered={() => console.debug('[Sale] Premium entered')}
                  onTabToServices={() => {
                    if (!openAccordions.includes('services')) {
                      setOpenAccordions(prev => [...prev, 'services']);
                    }
                    setTimeout(() => servicesTableRef.current?.focus(), 100);
                  }}
                  getActiveContractsForCompany={getActiveContractsForCompany}
                />
              </AccordionContent>
            </AccordionItem>

            {/* ─── 3. Services + Document Form ─── */}
            <AccordionItem value="services" className="card-elevated border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 transition-colors [&[data-state=open]>svg]:rotate-180">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Дополнительные услуги</span>
                  {serviceItems.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">
                      {serviceItems.length} шт.
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-2 pt-1 space-y-2">
                <ServicesTable
                  ref={servicesTableRef}
                  items={serviceItems}
                  onItemsChange={setServiceItems}
                  services={localServices}
                  onServicesUpdated={setLocalServices}
                  onTabToPayment={() => financeModuleRef.current?.focusPaymentMethod()}
                />

                {/* Document form panel (DKP / Europrotocol) — inside services accordion */}
                <DocumentFormPanel
                  ref={documentFormRef}
                  selectedServiceNames={selectedServiceNames}
                  clientId={selectedClient?.id || null}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* Sticky Footer - ALWAYS visible at bottom */}
      <div className="fixed bottom-0 right-0 z-50 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-[left] duration-200" style={{ left: 'var(--sidebar-width, 16rem)' }}>
        <StickyFinanceFooter
          ref={financeModuleRef}
          items={items}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          onToggleRounding={handleToggleRounding}
          onCancel={resetSale}
          onCompleteAndNext={() => actions.saveSale(true)}
          onPrintCashReceipt={actions.handlePrintCashReceipt}
          onPrintCommodityReceipt={actions.handlePrintCommodityReceipt}
          onPrintPndConsent={can('sale_legal') ? handlePrintPndConsent : undefined}
          hasClient={!!selectedClient}
          isPndSigned={!!(selectedClient as any)?.is_pnd_signed}
          isRoundingEnabled={isRoundingEnabled}
          showCommission={false}
          banks={saleData.banks}
          selectedBankId={selectedBankId}
          onBankChange={setSelectedBankId}
          installmentDueDate={installmentDueDate}
          onInstallmentDueDateChange={setInstallmentDueDate}
          installmentPaymentsCount={installmentPaymentsCount}
          onInstallmentPaymentsCountChange={setInstallmentPaymentsCount}
          roundingStep={saleData.agentSettings.roundingStep}
          selectedDebtsTotal={actions.selectedDebtsTotal}
        />
      </div>
    </div>
  );
}

// Compact sticky footer for mobile

interface StickyFinanceFooterProps {
  items: SaleItemRow[];
  paymentMethod: PaymentMethodType;
  onPaymentMethodChange: (method: PaymentMethodType) => void;
  onToggleRounding: (enabled: boolean, amount: number) => void;
  onCancel: () => void;
  onCompleteAndNext: () => void;
  onPrintCashReceipt: () => void;
  onPrintCommodityReceipt: () => void;
  isRoundingEnabled: boolean;
  showCommission: boolean;
  banks: { id: string; name: string }[];
  selectedBankId?: string;
  onBankChange: (id: string) => void;
  installmentDueDate?: string;
  onInstallmentDueDateChange: (date: string) => void;
  installmentPaymentsCount?: number;
  onInstallmentPaymentsCountChange: (count: number) => void;
  roundingStep?: number;
  selectedDebtsTotal?: number;
  onPrintPndConsent?: () => void;
  hasClient?: boolean;
  isPndSigned?: boolean;
}

const StickyFinanceFooter = forwardRef<FinanceModuleEnhancedRef, StickyFinanceFooterProps>(({
  items,
  paymentMethod,
  onPaymentMethodChange,
  onToggleRounding,
  onCancel,
  onCompleteAndNext,
  onPrintCashReceipt,
  onPrintCommodityReceipt,
  onPrintPndConsent,
  hasClient,
  isPndSigned,
  isRoundingEnabled,
  showCommission,
  banks,
  selectedBankId,
  onBankChange,
  installmentDueDate,
  onInstallmentDueDateChange,
  installmentPaymentsCount,
  onInstallmentPaymentsCountChange,
  roundingStep = 100,
  selectedDebtsTotal = 0,
}, ref) => {
  const { can } = usePermissions();

  // Debug: log granular payment permissions
  console.log("Available payment permissions:", {
    sale_process: can('sale_process'),
    pay_cash: can('pay_cash'),
    pay_card: can('pay_card'),
    pay_sbp: can('pay_sbp'),
    pay_transfer: can('pay_transfer'),
    pay_debt: can('pay_debt'),
  });

  const subtotal = useMemo(() => {
    return items.filter(item => item.type !== 'rounding').reduce((sum, item) => sum + item.premiumAmount, 0);
  }, [items]);

  // Subtotal only from items that participate in rounding
  const roundableSubtotal = useMemo(() => {
    return items
      .filter(item => item.type !== 'rounding' && item.isRoundable !== false)
      .reduce((sum, item) => sum + item.premiumAmount, 0);
  }, [items]);

  const roundingAmount = useMemo(() => {
    if (!isRoundingEnabled || roundableSubtotal === 0) return 0;
    return Math.ceil(roundableSubtotal / roundingStep) * roundingStep - roundableSubtotal;
  }, [isRoundingEnabled, roundableSubtotal, roundingStep]);

  const total = subtotal + roundingAmount + selectedDebtsTotal;
  const hasValidItems = items.some(item => item.type !== 'rounding' && item.premiumAmount > 0);

  const handleNoChangeToggle = useCallback(() => {
    const nextEnabled = !isRoundingEnabled;
    const nextAmount = nextEnabled && roundableSubtotal > 0
      ? Math.ceil(roundableSubtotal / roundingStep) * roundingStep - roundableSubtotal
      : 0;

    onToggleRounding(nextEnabled, nextAmount);
  }, [isRoundingEnabled, roundableSubtotal, roundingStep, onToggleRounding]);

  const paymentMethods: { id: PaymentMethodType; icon: React.ReactNode; label: string; permKey: string }[] = [
    { id: 'cash', icon: <Banknote className="h-3.5 w-3.5" />, label: 'Наличные', permKey: 'pay_cash' },
    { id: 'card', icon: <CreditCard className="h-3.5 w-3.5" />, label: 'Карта', permKey: 'pay_card' },
    { id: 'sbp', icon: <QrCode className="h-3.5 w-3.5" />, label: 'СБП', permKey: 'pay_sbp' },
    { id: 'transfer', icon: <Building2 className="h-3.5 w-3.5" />, label: 'Перевод', permKey: 'pay_transfer' },
    { id: 'debt', icon: <CalendarClock className="h-3.5 w-3.5" />, label: 'Долг', permKey: 'pay_debt' },
  ];

  const formatAmount = (value: number): string => {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-0">
      {/* Bank selection panel - expands upward */}
      {paymentMethod === 'transfer' && (
        <div className="p-2 border-b bg-muted/30">
          <Select value={selectedBankId} onValueChange={onBankChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Выберите банк" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Installment options panel - expands upward */}
      {paymentMethod === 'debt' && (
        <div className="p-2 border-b bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Срок до</label>
              <Input
                type="date"
                value={installmentDueDate || ''}
                onChange={(e) => onInstallmentDueDateChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Платежей</label>
              <Input
                type="number"
                value={installmentPaymentsCount || ''}
                onChange={(e) => onInstallmentPaymentsCountChange(parseInt(e.target.value) || 1)}
                min={1}
                max={12}
                className="h-8 text-xs"
                placeholder="1"
              />
            </div>
          </div>
          {installmentPaymentsCount && installmentPaymentsCount > 1 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Платёж: {formatAmount(total / installmentPaymentsCount)} ₽ × {installmentPaymentsCount}
            </p>
          )}
        </div>
      )}

      {/* Main footer - two rows */}
      <div className="p-2 space-y-2">
        {/* Row 1: Totals summary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-b pb-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Подытог:</span>
            <span className="font-medium">{formatAmount(subtotal)} ₽</span>
          </div>
          {isRoundingEnabled && subtotal > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Округл.:</span>
              <span className={cn(
                "font-medium",
                roundingAmount > 0 ? "text-success" : "text-muted-foreground"
              )}>
                {roundingAmount > 0 ? `+${formatAmount(roundingAmount)}` : formatAmount(0)} ₽
              </span>
            </div>
          )}
          {selectedDebtsTotal > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Погашение долга:</span>
              <span className="font-medium text-warning">+{formatAmount(selectedDebtsTotal)} ₽</span>
            </div>
          )}
        </div>

        {/* Row 2: Payment methods, print, total, actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Payment methods - with labels */}
          {can('sale_process') && (
          <div className="flex flex-wrap gap-1">
            {paymentMethods.map((method) => (
              can(method.permKey) && (
              <button
                key={method.id}
                onClick={() => onPaymentMethodChange(method.id)}
                className={cn(
                  "px-2 py-1 rounded-md border transition-all flex items-center gap-1 text-[11px]",
                  paymentMethod === method.id
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                {method.icon}
                <span className="hidden sm:inline">{method.label}</span>
              </button>
              )
            ))}
          </div>
          )}

          {/* Separator */}
          <div className="h-6 w-px bg-border hidden sm:block" />

          {/* No change toggle (for cash) - toggles rounding */}
          {can('receipt_none') && paymentMethod === 'cash' && (
            <button
              type="button"
              onClick={handleNoChangeToggle}
              disabled={subtotal === 0}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border cursor-pointer select-none",
                subtotal === 0 && "opacity-50 cursor-not-allowed",
                isRoundingEnabled
                  ? "bg-success text-success-foreground border-success"
                  : "bg-muted text-muted-foreground border-border hover:border-success/50"
              )}
            >
              Без сдачи
            </button>
          )}

          {/* Print buttons with labels */}
          {(can('receipt_cash') || can('receipt_bill') || can('sale_legal')) && (
          <div className="flex gap-1">
            {can('receipt_cash') && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-[11px] gap-1"
              onClick={onPrintCashReceipt}
              disabled={!hasValidItems}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Кассовый</span>
            </Button>
            )}
            {can('receipt_bill') && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-[11px] gap-1"
              onClick={onPrintCommodityReceipt}
              disabled={!hasValidItems}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Товарный</span>
            </Button>
            )}
            {can('sale_legal') && onPrintPndConsent && (
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "h-7 px-2 text-[11px] gap-1 border",
                hasClient && isPndSigned
                  ? "border-green-500 text-green-700 hover:bg-green-50"
                  : hasClient
                    ? "border-red-500 text-red-700 hover:bg-red-50"
                    : ""
              )}
              onClick={onPrintPndConsent}
              disabled={!hasClient}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Согласие ПДН</span>
            </Button>
            )}
          </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Total */}
          <div className="text-right">
            <div className="text-lg font-bold text-primary">
              Итого: {formatAmount(total)} ₽
            </div>
          </div>

          {/* Actions */}
          {can('sale_finalize') && (
          <>
          <Button onClick={onCancel} variant="outline" size="sm" className="h-8 gap-2 px-3">
            <X className="h-4 w-4" />
            <span>Отменить</span>
          </Button>
          <Button onClick={onCompleteAndNext} size="sm" disabled={!hasValidItems} className="h-8 gap-2 px-3 btn-gradient">
            <Check className="h-4 w-4" />
            <span>Провести и след.</span>
          </Button>
          </>
          )}
        </div>
      </div>
    </div>
  );
});

StickyFinanceFooter.displayName = 'StickyFinanceFooter';

// Memoize to prevent re-renders when switching tabs
export default memo(Sales);
