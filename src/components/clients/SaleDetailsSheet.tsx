import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Printer, Edit2, Loader2, Car, Calendar, Building2, 
  CreditCard, FileText, Receipt, Wrench, Banknote, Clock
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSaleDebtPayments } from '@/hooks/useDebtPayments';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';

interface SelectedItemInfo {
  type: 'policy' | 'sale' | 'service';
  title: string;
  policyNumber?: string;
  policySeries?: string;
  vehicleMark?: string;
  vehicleNumber?: string;
  insuranceCompany?: string;
  startDate?: string;
  endDate?: string;
  amount: number;
}

interface SaleDetailsSheetProps {
  saleId: string | null;
  selectedItemInfo?: SelectedItemInfo | null;
  onClose: () => void;
  onEdit?: (saleId: string) => void;
}

// Interface for sale_items table
interface SaleItemFromDB {
  id: string;
  sale_id: string;
  item_type: string;
  insurance_product_id: string | null;
  service_name: string | null;
  insurance_company: string | null;
  policy_series: string | null;
  policy_number: string | null;
  premium_amount: number | null;
  amount: number;
  commission_percent: number | null;
  commission_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  quantity: number | null;
  unit_price: number | null;
  created_at: string;
  // Join with insurance_products
  insurance_product?: {
    name: string;
    code: string;
  } | null;
}

interface SaleData {
  id: string;
  uid: string;
  total_amount: number;
  rounding_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    company_name: string | null;
    is_company: boolean;
    phone: string;
  } | null;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  contract: {
    id: string;
    contract_number: string;
    commission_rate: number;
  } | null;
}

export function SaleDetailsSheet({ saleId, selectedItemInfo, onClose, onEdit }: SaleDetailsSheetProps) {
  const { user } = useAuth();
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch user profile for full name
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch sale data
  const { data: sale, isLoading: saleLoading } = useQuery({
    queryKey: ['sale-details', saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, uid, total_amount, rounding_amount, payment_method, status, created_at, completed_at,
          client:clients(id, first_name, last_name, middle_name, company_name, is_company, phone),
          company:insurance_companies(id, name, logo_url),
          contract:insurance_contracts(id, contract_number, commission_rate)
        `)
        .eq('id', saleId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sale:', error);
        throw error;
      }

      return data as SaleData | null;
    },
    enabled: !!saleId,
  });

  // Fetch sale items from sale_items table
  const { data: saleItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['sale-items', saleId],
    queryFn: async () => {
      if (!saleId) return [];

      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          *,
          insurance_product:insurance_products(name, code)
        `)
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sale items:', error);
        throw error;
      }

      console.log('Loaded sale_items from DB:', data);
      return (data || []) as SaleItemFromDB[];
    },
    enabled: !!saleId,
  });

  // Fetch debt payments for this sale
  const { data: debtPayments = [] } = useSaleDebtPayments(saleId || '');

  const isLoading = saleLoading || itemsLoading;
  const isOpen = !!saleId || !!selectedItemInfo;

  // Get executor name - prefer profile full_name, fallback to metadata, then "Агент"
  const getExecutorName = () => {
    if (userProfile?.full_name) return userProfile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    return 'Агент';
  };

  // Get full client name including middle name
  const getFullClientName = () => {
    if (!sale?.client) return '—';
    
    if (sale.client.is_company) {
      return sale.client.company_name || '—';
    }
    
    const parts = [
      sale.client.last_name,
      sale.client.first_name,
      sale.client.middle_name
    ].filter(Boolean);
    
    return parts.join(' ') || '—';
  };

  const handlePrint = async () => {
    if (!sale) return;

    setIsPrinting(true);
    try {
      const clientName = getFullClientName();
      const now = new Date();
      const generatedAt = format(now, 'dd.MM.yyyy в HH:mm:ss');
      const preparedBy = getExecutorName();

      // Debug: log items data
      console.log('=== PRINT DEBUG ===');
      console.log('Sale:', sale);
      console.log('Sale Items:', saleItems);

      // Map items for printing from sale_items table
      const printItems = saleItems.map((item) => {
        const isService = item.item_type === 'service';
        
        // Get product/service name
        let productName = '—';
        if (isService) {
          productName = item.service_name || 'Услуга';
        } else {
          productName = item.insurance_product?.name || item.insurance_company || 'Страховой продукт';
        }
        
        // Get policy info - series + number
        let policyInfo = '—';
        if (!isService && (item.policy_series || item.policy_number)) {
          const series = item.policy_series || '';
          const number = item.policy_number || '';
          policyInfo = `${series}${series && number ? ' ' : ''}${number}`.trim() || '—';
        }
        
        // Get vehicle info - for now we don't have it in sale_items, show dash
        const vehicleInfo = '—';
        
        // Get period - start to end date
        let period = '—';
        if (!isService && item.start_date && item.end_date) {
          try {
            const start = format(parseISO(item.start_date), 'dd.MM.yyyy');
            const end = format(parseISO(item.end_date), 'dd.MM.yyyy');
            period = `${start} — ${end}`;
          } catch (e) {
            console.error('Date parse error:', e);
            period = '—';
          }
        } else if (!isService && item.start_date) {
          try {
            period = `с ${format(parseISO(item.start_date), 'dd.MM.yyyy')}`;
          } catch (e) {
            period = '—';
          }
        }
        
        // Get amount
        const amount = Number(item.premium_amount || item.amount || item.unit_price || 0);
        
        return {
          name: productName,
          isService,
          policyInfo,
          vehicleInfo,
          period,
          amount,
          insuranceCompany: item.insurance_company || '',
        };
      });

      console.log('Mapped print items:', printItems);

      // Calculate sum of items (before rounding)
      const itemsSum = printItems.reduce((sum, item) => sum + item.amount, 0);
      
      // Get rounding amount
      const roundingAmount = Number(sale.rounding_amount || 0);
      
      // Total amount (what client pays)
      const totalAmount = Number(sale.total_amount || 0);

      // Generate table rows
      let tableRowsHtml = '';
      if (printItems.length > 0) {
        tableRowsHtml = printItems.map((item) => `
          <tr class="${item.isService ? 'service-row' : ''}">
            <td>
              ${item.name}${item.isService ? '<span class="service-badge">Услуга</span>' : ''}
              ${item.insuranceCompany && !item.isService ? `<div class="insurance-company">${item.insuranceCompany}</div>` : ''}
            </td>
            <td>${item.policyInfo}</td>
            <td>${item.vehicleInfo}</td>
            <td>${item.period}</td>
            <td class="amount">${item.amount.toLocaleString('ru-RU')} ₽</td>
          </tr>
        `).join('');
      } else {
        tableRowsHtml = `
          <tr>
            <td colspan="5" style="text-align: center; color: #666; padding: 20px;">Нет позиций</td>
          </tr>
        `;
      }

      // Generate rounding row
      const roundingRowHtml = roundingAmount !== 0 ? `
        <div class="total-row">
          <span>Округление:</span>
          <span>${roundingAmount > 0 ? '+' : ''}${roundingAmount.toLocaleString('ru-RU')} ₽</span>
        </div>
      ` : '';

      const receiptHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <title>Документ #${sale.uid}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              font-size: 12px; 
              line-height: 1.5;
              max-width: 210mm;
              margin: 0 auto;
              padding: 20px;
              color: #1a1a1a;
            }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
            .header h1 { font-size: 18px; margin-bottom: 5px; }
            .meta { font-size: 10px; color: #666; margin-top: 10px; }
            .section { margin: 15px 0; }
            .section-title { font-size: 11px; font-weight: bold; color: #666; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .info-item { padding: 8px; background: #f8f9fa; border-radius: 4px; }
            .info-label { font-size: 10px; color: #666; }
            .info-value { font-size: 12px; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
            th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; font-weight: 600; }
            .amount { text-align: right; font-weight: bold; white-space: nowrap; }
            .totals { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
            .total-divider { border-top: 3px solid #333; margin-top: 12px; padding-top: 12px; }
            .total-main { font-size: 18px; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; }
            .signature { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-line { width: 200px; border-top: 1px solid #333; padding-top: 5px; text-align: center; font-size: 10px; }
            .company-logo { height: 30px; margin-bottom: 5px; }
            .service-row { background: #fafafa; }
            .service-badge { 
              display: inline-block; 
              background: #e0e0e0; 
              padding: 1px 6px; 
              border-radius: 3px; 
              font-size: 9px; 
              margin-left: 5px;
              vertical-align: middle;
            }
            .insurance-company { font-size: 10px; color: #666; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${sale.company?.logo_url ? `<img src="${sale.company.logo_url}" class="company-logo" alt="${sale.company.name}">` : ''}
            <h1>Документ #${sale.uid}</h1>
            <div class="meta">
              Сформировано: ${generatedAt}<br>
              Подготовил: ${preparedBy}
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Клиент</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">ФИО / Название</div>
                <div class="info-value">${clientName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Телефон</div>
                <div class="info-value">${sale.client?.phone ? maskPhone(sale.client.phone) : '—'}</div>
              </div>
            </div>
          </div>

          ${sale.company ? `
          <div class="section">
            <div class="section-title">Страховая компания</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Название</div>
                <div class="info-value">${sale.company.name}</div>
              </div>
              ${sale.contract ? `
              <div class="info-item">
                <div class="info-label">Договор</div>
                <div class="info-value">${sale.contract.contract_number}</div>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Позиции</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 28%;">Наименование</th>
                  <th style="width: 14%;">Полис</th>
                  <th style="width: 18%;">Объект</th>
                  <th style="width: 24%;">Период</th>
                  <th style="width: 16%;" class="amount">Сумма</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <div class="total-row">
              <span>Сумма позиций:</span>
              <span>${itemsSum.toLocaleString('ru-RU')} ₽</span>
            </div>
            ${roundingRowHtml}
            <div class="total-row total-divider total-main">
              <span>ИТОГО К ОПЛАТЕ:</span>
              <span>${totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>

          <div class="section" style="margin-top: 20px;">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Способ оплаты</div>
                <div class="info-value">${sale.payment_method === 'cash' ? 'Наличные' : sale.payment_method === 'card' ? 'Карта' : sale.payment_method === 'mixed' ? 'Смешанная' : sale.payment_method || '—'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Дата оформления</div>
                <div class="info-value">${format(parseISO(sale.completed_at || sale.created_at), 'dd.MM.yyyy HH:mm')}</div>
              </div>
            </div>
          </div>

          <div class="signature">
            <div class="signature-line">Подпись клиента</div>
            <div class="signature-line">Подпись агента</div>
          </div>

          <div class="footer">
            Спасибо за выбор наших услуг!
          </div>
          
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `;

      console.log('Opening print window...');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
      }
    } catch (error) {
      console.error('Print error:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Наличные';
      case 'card': return 'Карта';
      case 'mixed': return 'Смешанная';
      default: return method;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Завершена</Badge>;
      case 'draft':
        return <Badge variant="secondary">Черновик</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Отменена</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Separate items into products and services
  const insuranceItems = saleItems.filter(item => item.item_type !== 'service');
  const serviceItems = saleItems.filter(item => item.item_type === 'service');

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !sale ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Сделка не найдена</p>
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-1 pb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl">
                  {selectedItemInfo?.title || 'Детали сделки'}
                </SheetTitle>
                {getStatusBadge(sale.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                Чек #{sale.uid}
              </p>
            </SheetHeader>

            <Separator className="my-4" />

            {/* Insurance Company */}
            {sale.company && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 mb-4">
                {sale.company.logo_url ? (
                  <img 
                    src={sale.company.logo_url} 
                    alt={sale.company.name}
                    className="h-10 w-10 object-contain rounded bg-white p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{sale.company.name}</p>
                  {sale.contract && (
                    <p className="text-xs text-muted-foreground">
                      Договор: {sale.contract.contract_number}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Client Info */}
            <div className="p-3 rounded-lg bg-muted/30 mb-4">
              <p className="text-xs text-muted-foreground">Клиент</p>
              <p className="font-medium">{getFullClientName()}</p>
              {sale.client?.phone && (
                <MaskedPhone
                  phone={sale.client.phone}
                  clientId={sale.client?.id || ''}
                  clientName={getFullClientName()}
                  className="text-sm"
                  context="Детали продажи"
                />
              )}
            </div>

            {/* Finance Section */}
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Финансы
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Сумма сделки</p>
                  <p className="text-lg font-semibold">
                    {Number(sale.total_amount).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Способ оплаты</p>
                  <p className="text-lg font-semibold">
                    {getPaymentMethodLabel(sale.payment_method)}
                  </p>
                </div>
              </div>
              {Number(sale.rounding_amount) !== 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-sm text-muted-foreground">Округление (без сдачи)</span>
                  <span className="text-sm font-medium text-primary">
                    {Number(sale.rounding_amount) > 0 ? '+' : ''}{Number(sale.rounding_amount).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              )}
            </div>

            {/* Insurance Products */}
            {insuranceItems.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Страховые продукты ({insuranceItems.length})
                  </h4>
                  <div className="space-y-2">
                    {insuranceItems.map((item) => (
                      <div 
                        key={item.id}
                        className="p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {item.insurance_product?.name || 'Страховой продукт'}
                          </span>
                          <span className="font-semibold">
                            {Number(item.premium_amount || item.amount || 0).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(item.policy_series || item.policy_number) && (
                            <div>
                              <span className="text-muted-foreground">Полис: </span>
                              <span className="font-medium">{item.policy_series || ''}{item.policy_number || ''}</span>
                            </div>
                          )}
                          {item.insurance_company && (
                            <div>
                              <span className="text-muted-foreground">СК: </span>
                              <span className="font-medium">{item.insurance_company}</span>
                            </div>
                          )}
                          {(item.start_date || item.end_date) && (
                            <div className="flex items-center gap-1 col-span-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {item.start_date ? format(parseISO(item.start_date), 'dd.MM.yy') : '—'} — {item.end_date ? format(parseISO(item.end_date), 'dd.MM.yy') : '—'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Services */}
            {serviceItems.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Дополнительные услуги ({serviceItems.length})
                  </h4>
                  <div className="space-y-2">
                    {serviceItems.map((item) => (
                      <div 
                        key={item.id}
                        className="p-3 rounded-lg border border-border bg-accent/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {item.service_name || 'Услуга'}
                          </span>
                          <span className="font-semibold">
                            {Number(item.amount || item.unit_price || 0).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        {item.quantity && item.quantity > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Количество: {item.quantity}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Debt Payment History */}
            {debtPayments.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3 mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    История погашения ({debtPayments.length})
                  </h4>
                  <div className="space-y-2">
                    {debtPayments.map((payment) => (
                      <div 
                        key={payment.id}
                        className="p-3 rounded-lg border border-border bg-success/5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {payment.payment_method === 'cash' ? (
                              <Banknote className="h-4 w-4 text-success" />
                            ) : (
                              <CreditCard className="h-4 w-4 text-primary" />
                            )}
                            <span className="text-sm font-medium">
                              {payment.payment_method === 'cash' ? 'Наличные' : 'Карта'}
                            </span>
                          </div>
                          <span className="font-semibold text-success">
                            +{Number(payment.amount).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(payment.paid_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Meta Info */}
            <Separator className="my-4" />
            <div className="text-xs text-muted-foreground space-y-1 mb-6">
              <p>
                Создано: {format(parseISO(sale.created_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </p>
              {sale.completed_at && (
                <p>
                  Завершено: {format(parseISO(sale.completed_at), 'd MMMM yyyy, HH:mm', { locale: ru })}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handlePrint}
                disabled={isPrinting}
                className="flex-1 gap-2"
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Печать документа
              </Button>
              {onEdit && (
                <Button 
                  variant="outline"
                  onClick={() => onEdit(sale.id)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Редактировать
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
