import { SaleItemRow } from '@/components/sales/SaleItemsTableInline';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface DebtRepaymentItem {
  id: string;
  saleId: string;
  productName: string;
  policySeries?: string;
  policyNumber?: string;
  vehicleBrand?: string;
  vehicleNumber?: string;
  startDate?: string;
  endDate?: string;
  amount: number;
}

interface ReceiptData {
  uid: string;
  date: Date;
  clientName: string;
  clientPhone: string;
  items: SaleItemRow[];
  total: number;
  paymentMethod: string;
  agentName: string;
  roundingAmount?: number;
  debtRepayments?: DebtRepaymentItem[];
}

const formatAmount = (value: number): string => {
  return value.toFixed(2).replace('.', ',');
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Банковская карта',
  sbp: 'СБП',
  transfer: 'Банковский перевод',
  debt: 'В долг / Рассрочка',
};

export function generateCashReceiptPDF(data: ReceiptData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Build items including debt repayments
  const allItems = [...data.items];
  const debtRows = data.debtRepayments || [];

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Кассовый чек ${data.uid}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          font-size: 12px; 
          padding: 10mm;
          max-width: 80mm;
          margin: 0 auto;
        }
        .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .title { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
        .info { margin: 10px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .items { margin: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; }
        .item { margin: 5px 0; }
        .item-name { font-weight: bold; }
        .item-details { font-size: 11px; color: #444; }
        .item-price { display: flex; justify-content: space-between; font-size: 11px; }
        .total { margin: 10px 0; font-weight: bold; font-size: 14px; text-align: right; }
        .rounding { display: flex; justify-content: space-between; font-size: 11px; color: #666; }
        .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">КАССОВЫЙ ЧЕК</div>
        <div>СтрахАгент CRM</div>
      </div>
      
      <div class="info">
        <div class="info-row">
          <span>Документ:</span>
          <span>${data.uid}</span>
        </div>
        <div class="info-row">
          <span>Дата:</span>
          <span>${format(data.date, 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
        </div>
        <div class="info-row">
          <span>Клиент:</span>
          <span>${data.clientName}</span>
        </div>
        <div class="info-row">
          <span>Телефон:</span>
          <span>${data.clientPhone}</span>
        </div>
      </div>

      <div class="items">
        ${allItems.filter(item => item.type !== 'rounding').map(item => `
          <div class="item">
            <div class="item-name">
              ${item.type === 'insurance' ? item.productName : (item.serviceName || 'Услуга')}
            </div>
            ${item.type === 'insurance' ? `
              <div class="item-details">
                ${item.series || item.number ? `Полис: ${item.series || ''} ${item.number || ''}`.trim() : ''}
              </div>
              ${item.vehicleBrand || item.vehicleNumber ? `
                <div class="item-details">
                  Авто: ${item.vehicleBrand || '—'} ${item.vehicleNumber || ''}
                </div>
              ` : ''}
              <div class="item-details">
                ${formatDate(item.startDate)} — ${formatDate(item.endDate)}
              </div>
            ` : `
              <div class="item-details">
                ${(item.quantity || 1)} × ${formatAmount(item.unitPrice || item.premiumAmount || 0)} ₽
              </div>
            `}
            <div class="item-price">
              <span></span>
              <span>${formatAmount(item.premiumAmount)} ₽</span>
            </div>
          </div>
        `).join('')}
        
        ${debtRows.map(debt => `
          <div class="item">
            <div class="item-name">Погашение долга: ${debt.productName}</div>
            ${debt.policySeries || debt.policyNumber ? `
              <div class="item-details">
                Полис: ${debt.policySeries || ''} ${debt.policyNumber || ''}
              </div>
            ` : ''}
            ${debt.vehicleBrand || debt.vehicleNumber ? `
              <div class="item-details">
                Авто: ${debt.vehicleBrand || '—'} ${debt.vehicleNumber || ''}
              </div>
            ` : ''}
            ${debt.startDate || debt.endDate ? `
              <div class="item-details">
                ${formatDate(debt.startDate)} — ${formatDate(debt.endDate)}
              </div>
            ` : ''}
            <div class="item-price">
              <span></span>
              <span>${formatAmount(debt.amount)} ₽</span>
            </div>
          </div>
        `).join('')}
      </div>

      ${(data.roundingAmount && data.roundingAmount !== 0) ? `
        <div class="rounding">
          <span>Округление:</span>
          <span>${data.roundingAmount > 0 ? '+' : ''}${formatAmount(data.roundingAmount)} ₽</span>
        </div>
      ` : ''}

      <div class="total">
        ИТОГО: ${formatAmount(data.total)} ₽
      </div>

      <div class="info">
        <div class="info-row">
          <span>Оплата:</span>
          <span>${paymentMethodLabels[data.paymentMethod] || data.paymentMethod}</span>
        </div>
        <div class="info-row">
          <span>Агент:</span>
          <span>${data.agentName}</span>
        </div>
      </div>

      <div class="footer">
        <p>Спасибо за покупку!</p>
        <p>Документ сформирован в СтрахАгент CRM</p>
      </div>

      <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
        Печать
      </button>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export function generateCommodityReceiptPDF(data: ReceiptData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const allItems = data.items.filter(item => item.type !== 'rounding');
  const debtRows = data.debtRepayments || [];
  const effectiveRounding = Number(data.roundingAmount || 0);

  // Calculate subtotal (all items + debts, without rounding)
  const subtotal = allItems.reduce((sum, item) => sum + item.premiumAmount, 0) 
    + debtRows.reduce((sum, d) => sum + d.amount, 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Товарный чек ${data.uid}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4 portrait; margin: 15mm; }
        body { 
          font-family: 'PT Sans', Arial, sans-serif; 
          font-size: 11px; 
          padding: 15mm;
          max-width: 210mm;
          color: #333;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
        .subtitle { color: #666; }
        .info { margin: 15px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .info-item { }
        .info-label { color: #666; font-size: 10px; }
        .info-value { font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f5f5f5; font-weight: 600; font-size: 10px; }
        td { font-size: 11px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .rounding-row { background: #fafafa; font-style: italic; color: #666; }
        .separator-row td { border-top: 2px solid #333; padding: 0; height: 0; }
        .total-row { font-weight: bold; background: #f0f9ff; font-size: 13px; }
        .total-row td { padding: 12px 8px; }
        .footer { margin-top: 30px; }
        .generated-info { font-size: 10px; color: #666; margin-top: 20px; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature-block { width: 45%; }
        .signature-line { border-bottom: 1px solid #000; margin-top: 30px; padding-bottom: 5px; }
        .signature-label { font-size: 10px; color: #666; margin-top: 3px; }
        .empty-cell { color: #999; }
        @media print {
          body { padding: 10mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">ТОВАРНЫЙ ЧЕК</div>
        <div class="subtitle">№ ${data.uid}</div>
      </div>
      
      <div class="info">
        <div class="info-item">
          <div class="info-label">Дата и время</div>
          <div class="info-value">${format(data.date, 'dd MMMM yyyy г., HH:mm', { locale: ru })}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Клиент</div>
          <div class="info-value">${data.clientName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Телефон</div>
          <div class="info-value">${data.clientPhone}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Способ оплаты</div>
          <div class="info-value">${paymentMethodLabels[data.paymentMethod] || data.paymentMethod}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%">№</th>
            <th style="width: 25%">Наименование</th>
            <th style="width: 20%">Полис</th>
            <th style="width: 20%">Объект</th>
            <th style="width: 18%">Период</th>
            <th style="width: 12%" class="text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${allItems.map((item, index) => {
            const isInsurance = item.type === 'insurance';
            const policyStr = isInsurance 
              ? (item.series || item.number ? `${item.series || ''} ${item.number || ''}`.trim() : '—')
              : '—';
            const vehicleStr = isInsurance
              ? (item.vehicleBrand || item.vehicleNumber 
                  ? `${item.vehicleBrand || '—'}<br/>${item.vehicleNumber || ''}` 
                  : '—')
              : '—';
            const periodStr = isInsurance
              ? `${formatDate(item.startDate)}<br/>— ${formatDate(item.endDate)}`
              : '—';
            
            return `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${isInsurance ? item.productName : (item.serviceName || 'Услуга')}${item.type === 'service' && item.quantity && item.quantity > 1 ? ` (×${item.quantity})` : ''}</td>
                <td>${policyStr}</td>
                <td>${vehicleStr}</td>
                <td>${periodStr}</td>
                <td class="text-right">${formatAmount(item.premiumAmount)} ₽</td>
              </tr>
            `;
          }).join('')}
          
          ${debtRows.map((debt, index) => {
            const policyStr = debt.policySeries || debt.policyNumber 
              ? `${debt.policySeries || ''} ${debt.policyNumber || ''}`.trim() 
              : '—';
            const vehicleStr = debt.vehicleBrand || debt.vehicleNumber 
              ? `${debt.vehicleBrand || '—'}<br/>${debt.vehicleNumber || ''}` 
              : '—';
            const periodStr = debt.startDate || debt.endDate
              ? `${formatDate(debt.startDate)}<br/>— ${formatDate(debt.endDate)}`
              : '—';
            
            return `
              <tr>
                <td class="text-center">${allItems.length + index + 1}</td>
                <td>Погашение долга: ${debt.productName}</td>
                <td>${policyStr}</td>
                <td>${vehicleStr}</td>
                <td>${periodStr}</td>
                <td class="text-right">${formatAmount(debt.amount)} ₽</td>
              </tr>
            `;
          }).join('')}
          
          ${effectiveRounding !== 0 ? `
            <tr class="rounding-row">
              <td class="text-center">—</td>
              <td>Округление (без сдачи)</td>
              <td class="empty-cell">—</td>
              <td class="empty-cell">—</td>
              <td class="empty-cell">—</td>
              <td class="text-right">${effectiveRounding > 0 ? '+' : ''}${formatAmount(effectiveRounding)} ₽</td>
            </tr>
          ` : ''}
          
          <tr class="separator-row">
            <td colspan="6"></td>
          </tr>
          
          <tr class="total-row">
            <td colspan="5" class="text-right">ИТОГО К ОПЛАТЕ:</td>
            <td class="text-right">${formatAmount(data.total)} ₽</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <p>Агент: ${data.agentName}</p>
      </div>

      <div class="generated-info">
        Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}
      </div>

      <div class="signature">
        <div class="signature-block">
          <div class="signature-line">${data.agentName}</div>
          <div class="signature-label">Подготовил (Агент)</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-label">Подпись клиента</div>
        </div>
      </div>

      <button class="no-print" onclick="window.print()" style="margin-top: 30px; padding: 10px 20px; cursor: pointer;">
        Печать
      </button>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
