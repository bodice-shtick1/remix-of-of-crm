import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface DebtPaymentDetailExport {
  id: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  client_name: string;
  sale_description: string;
  debt_date: string;
}

export interface ExportShiftData {
  shiftId: string;
  shiftNumber?: number;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number;
  incomeCash: number;
  incomeNonCash: number;
  incomeDebt: number;
  // Debt repayments
  debtRepaymentCash?: number;
  debtRepaymentCard?: number;
  debtRepaymentTotal?: number;
  debtPaymentDetails?: DebtPaymentDetailExport[];
  totalRevenue: number;
  withdrawal: number;
  amountToKeep?: number;
  managerName?: string;
  // Notification stats
  notificationStats?: {
    total_prepared: number;
    sent: number;
    delivered: number;
    read: number;
    error: number;
    test_prepared: number;
  };
  salesSummary: Array<{
    insurance_company: string | null;
    product_name: string | null;
    count: number;
    total_cash: number;
    total_non_cash: number;
    total_amount: number;
  }>;
  servicesSummary: Array<{
    service_name: string;
    count: number;
    total_cash: number;
    total_non_cash: number;
    total_amount: number;
  }>;
  transactions?: Array<{
    date: string;
    uid: string;
    clientName: string;
    itemType: string;
    itemName: string;
    paymentMethod: string;
    amount: number;
  }>;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generatePrintableHTML(data: ExportShiftData, isDetailed: boolean): string {
  const openedDate = format(new Date(data.openedAt), 'dd.MM.yyyy HH:mm', { locale: ru });
  const closedDate = data.closedAt 
    ? format(new Date(data.closedAt), 'dd.MM.yyyy HH:mm', { locale: ru })
    : 'Не закрыта';
  const reportDate = data.closedAt 
    ? format(new Date(data.closedAt), 'dd.MM.yyyy', { locale: ru })
    : format(new Date(data.openedAt), 'dd.MM.yyyy', { locale: ru });
  const now = new Date();
  const generatedAt = format(now, 'dd.MM.yyyy в HH:mm:ss', { locale: ru });

  // CRITICAL: Force Number() conversion for all calculations
  const openingBalance = Number(data.openingBalance) || 0;
  const incomeCash = Number(data.incomeCash) || 0;
  const incomeNonCash = Number(data.incomeNonCash) || 0;
  const incomeDebt = Number(data.incomeDebt) || 0;
  const debtRepaymentCash = Number(data.debtRepaymentCash) || 0;
  const debtRepaymentCard = Number(data.debtRepaymentCard) || 0;
  const debtRepaymentTotal = Number(data.debtRepaymentTotal) || 0;
  const totalRevenue = Number(data.totalRevenue) || 0;
  const withdrawal = Number(data.withdrawal) || 0;
  const closingBalance = Number(data.closingBalance) || 0;

  // Calculate totals for cash register
  // FORMULA: Opening + Cash Sales + Cash Debt Repayments = Total Before Withdrawal
  const totalCashIncome = incomeCash + debtRepaymentCash;
  const totalInRegisterBeforeWithdrawal = openingBalance + totalCashIncome;
  const balanceAfterWithdrawal = totalInRegisterBeforeWithdrawal - withdrawal;

  let html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Сменный кассовый отчёт</title>
  <style>
    @page { size: portrait; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Arial', sans-serif; 
      font-size: 10px; 
      line-height: 1.35;
      color: #000;
      background: #fff;
      padding: 15px;
    }
    h1 { font-size: 15px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    h2 { font-size: 11px; margin: 12px 0 6px; border-bottom: 2px solid #000; padding-bottom: 3px; text-transform: uppercase; }
    .print-controls { 
      background: #f5f5f5; 
      padding: 12px 16px; 
      margin-bottom: 15px; 
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px solid #ddd;
    }
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #1a1a1a;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .print-btn:hover { background: #333; }
    .print-btn svg { width: 16px; height: 16px; }
    .print-hint { color: #666; font-size: 11px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 3px solid #000; padding-bottom: 10px; }
    .header .date { font-size: 12px; margin-top: 4px; font-weight: bold; }
    .meta { color: #333; font-size: 10px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: auto; }
    th, td { padding: 4px 6px; text-align: left; border: 1px solid #000; font-size: 10px; }
    th { background: #f0f0f0; font-weight: bold; font-size: 9px; text-transform: uppercase; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .bg-gray { background: #f5f5f5; }
    .bg-highlight { background: #e8f5e9; }
    .total-row td { font-weight: bold; background: #f0f0f0; }
    .cash-section { margin-top: 15px; }
    .cash-table td:first-child { width: 60%; }
    .cash-table td:last-child { width: 40%; text-align: right; font-weight: bold; font-size: 11px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 35px; page-break-inside: avoid; }
    .signature-block { width: 45%; }
    .signature-line { border-bottom: 1px solid #000; height: 25px; margin-top: 8px; }
    .signature-label { font-size: 9px; margin-top: 4px; color: #333; }
    .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #333; border-top: 1px solid #000; padding-top: 10px; }
    .manager-info { margin-top: 10px; font-size: 10px; }
    .nowrap { white-space: nowrap; }
    @media print { 
      .print-controls { display: none !important; } 
      body { padding: 0; font-size: 10px; }
    }
  </style>
</head>
<body>
  <!-- Print Controls - Hidden when printing -->
  <div class="print-controls">
    <div>
      <button class="print-btn" onclick="window.print()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Распечатать отчёт
      </button>
    </div>
    <div class="print-hint">Нажмите кнопку или используйте Ctrl+P для печати</div>
  </div>

  <div class="header">
    <h1>СМЕННЫЙ КАССОВЫЙ ОТЧЁТ № ${data.shiftNumber || data.shiftId.substring(0, 8).toUpperCase()}</h1>
    <div class="date">Дата: ${reportDate}</div>
    <div class="meta">Открытие: ${openedDate} | Закрытие: ${closedDate}</div>
    <div class="manager-info">Менеджер: <strong>${data.managerName || '—'}</strong></div>
  </div>

  <!-- Cash Register Section -->
  <h2>Движение денежных средств (Касса)</h2>
  <table class="cash-table">
    <tbody>
      <tr>
        <td>Начальный остаток на начало смены</td>
        <td>${formatCurrency(openingBalance)}</td>
      </tr>
      <tr>
        <td>Приход по продажам (наличные)</td>
        <td>${formatCurrency(incomeCash)}</td>
      </tr>
      <tr>
        <td>Приход по долгам / рассрочкам (наличные)</td>
        <td>${formatCurrency(debtRepaymentCash)}</td>
      </tr>
      <tr class="total-row">
        <td>ИТОГО В КАССЕ ДО ВЫЕМКИ</td>
        <td>${formatCurrency(totalInRegisterBeforeWithdrawal)}</td>
      </tr>
      <tr>
        <td>Инкассация (Выемка)</td>
        <td>${formatCurrency(withdrawal)}</td>
      </tr>
      <tr class="total-row bg-highlight">
        <td>ОСТАТОК НА РАЗМЕН (на конец дня)</td>
        <td>${formatCurrency(balanceAfterWithdrawal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Revenue Summary -->
  <h2>Выручка по типам оплаты</h2>
  <table>
    <thead>
      <tr>
        <th>Тип оплаты</th>
        <th class="text-right">Продажи</th>
        <th class="text-right">Погашение долгов</th>
        <th class="text-right">Итого</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Наличные</td>
        <td class="text-right">${formatCurrency(incomeCash)}</td>
        <td class="text-right">${formatCurrency(debtRepaymentCash)}</td>
        <td class="text-right font-bold">${formatCurrency(incomeCash + debtRepaymentCash)}</td>
      </tr>
      <tr>
        <td>Безналичные (карта/перевод)</td>
        <td class="text-right">${formatCurrency(incomeNonCash)}</td>
        <td class="text-right">${formatCurrency(debtRepaymentCard)}</td>
        <td class="text-right font-bold">${formatCurrency(incomeNonCash + debtRepaymentCard)}</td>
      </tr>
      <tr>
        <td>Рассрочка (новые)</td>
        <td class="text-right">${formatCurrency(incomeDebt)}</td>
        <td class="text-right">—</td>
        <td class="text-right font-bold">${formatCurrency(incomeDebt)}</td>
      </tr>
      <tr class="total-row">
        <td>ИТОГО ВЫРУЧКА</td>
        <td class="text-right">${formatCurrency(totalRevenue)}</td>
        <td class="text-right">${formatCurrency(debtRepaymentTotal)}</td>
        <td class="text-right">${formatCurrency(totalRevenue + debtRepaymentTotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Debt Payments Detail Table -->
`;

  const paymentMethodLabelsMap: Record<string, string> = {
    cash: 'Наличные',
    card: 'Карта',
    transfer: 'Перевод',
    sbp: 'СБП',
  };

  if (data.debtPaymentDetails && data.debtPaymentDetails.length > 0) {
    html += `
  <h2>Реестр принятых платежей по задолженностям</h2>
  <table>
    <thead>
      <tr>
        <th>№ Квитанции</th>
        <th>Клиент</th>
        <th>Основание</th>
        <th>Дата долга</th>
        <th class="text-center">Оплата</th>
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
`;
    data.debtPaymentDetails.forEach((payment, idx) => {
      const debtDate = format(new Date(payment.debt_date), 'dd.MM.yyyy', { locale: ru });
      const methodLabel = paymentMethodLabelsMap[payment.payment_method] || payment.payment_method;
      const receiptNumber = payment.id ? payment.id.substring(0, 8).toUpperCase() : `${idx + 1}`;
      html += `
      <tr>
        <td class="nowrap">${receiptNumber}</td>
        <td>${payment.client_name}</td>
        <td>${payment.sale_description}</td>
        <td class="nowrap">${debtDate}</td>
        <td class="text-center">${methodLabel}</td>
        <td class="text-right font-bold nowrap">${formatCurrency(payment.amount)}</td>
      </tr>
`;
    });
    html += `
      <tr class="total-row">
        <td colspan="5">ИТОГО погашение долгов</td>
        <td class="text-right">${formatCurrency(debtRepaymentTotal)}</td>
      </tr>
    </tbody>
  </table>
`;
  } else {
    html += `
  <p style="margin: 10px 0; font-size: 10px;">Приход по долгам: 0 ₽</p>
`;
  }

  // Sales Summary Table
  if (data.salesSummary.length > 0) {
    html += `
  <h2>Страховые продукты</h2>
  <table>
    <thead>
      <tr>
        <th>Компания</th>
        <th>Продукт</th>
        <th class="text-center">Кол-во</th>
        ${isDetailed ? '<th class="text-right">Нал</th><th class="text-right">Безнал</th>' : ''}
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
`;
    let salesTotal = 0;
    data.salesSummary.forEach(item => {
      salesTotal += item.total_amount;
      html += `
      <tr>
        <td>${item.insurance_company || '—'}</td>
        <td>${item.product_name || '—'}</td>
        <td class="text-center">${item.count}</td>
        ${isDetailed ? `<td class="text-right">${formatCurrency(item.total_cash)}</td><td class="text-right">${formatCurrency(item.total_non_cash)}</td>` : ''}
        <td class="text-right font-bold">${formatCurrency(item.total_amount)}</td>
      </tr>
`;
    });
    html += `
      <tr class="total-row">
        <td colspan="${isDetailed ? 5 : 3}">ИТОГО по страховым продуктам</td>
        <td class="text-right">${formatCurrency(salesTotal)}</td>
      </tr>
    </tbody>
  </table>
`;
  }

  // Services Summary Table
  if (data.servicesSummary.length > 0) {
    html += `
  <h2>Услуги</h2>
  <table>
    <thead>
      <tr>
        <th>Услуга</th>
        <th class="text-center">Кол-во</th>
        ${isDetailed ? '<th class="text-right">Нал</th><th class="text-right">Безнал</th>' : ''}
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
`;
    let servicesTotal = 0;
    data.servicesSummary.forEach(item => {
      servicesTotal += item.total_amount;
      html += `
      <tr>
        <td>${item.service_name}</td>
        <td class="text-center">${item.count}</td>
        ${isDetailed ? `<td class="text-right">${formatCurrency(item.total_cash)}</td><td class="text-right">${formatCurrency(item.total_non_cash)}</td>` : ''}
        <td class="text-right font-bold">${formatCurrency(item.total_amount)}</td>
      </tr>
`;
    });
    html += `
      <tr class="total-row">
        <td colspan="${isDetailed ? 4 : 2}">ИТОГО по услугам</td>
        <td class="text-right">${formatCurrency(servicesTotal)}</td>
      </tr>
    </tbody>
  </table>
`;
  }

  // Detailed transactions
  if (isDetailed && data.transactions && data.transactions.length > 0) {
    html += `
  <h2>Детализация операций</h2>
  <table>
    <thead>
      <tr>
        <th>Дата/Время</th>
        <th>№ Чека</th>
        <th>Клиент</th>
        <th>Тип</th>
        <th>Наименование</th>
        <th>Оплата</th>
        <th class="text-right">Сумма</th>
      </tr>
    </thead>
    <tbody>
`;
    data.transactions.forEach(t => {
      html += `
      <tr>
        <td>${t.date}</td>
        <td>${t.uid}</td>
        <td>${t.clientName}</td>
        <td>${t.itemType}</td>
        <td>${t.itemName}</td>
        <td>${t.paymentMethod}</td>
        <td class="text-right font-bold">${formatCurrency(t.amount)}</td>
      </tr>
`;
    });
    html += `
    </tbody>
  </table>
`;
  }

  // Notification Stats Section (compact, below financial data)
  if (data.notificationStats && data.notificationStats.total_prepared > 0) {
    const ns = data.notificationStats;
    const realSent = ns.sent + ns.delivered + ns.read;
    html += `
  <h2>Отчёт по автоматическим уведомлениям</h2>
  <table class="cash-table">
    <tbody>
      <tr>
        <td>Подготовлено автопилотом</td>
        <td>${ns.total_prepared - ns.test_prepared}</td>
      </tr>
      <tr>
        <td>Успешно отправлено</td>
        <td>${realSent}</td>
      </tr>
      <tr>
        <td>Доставлено</td>
        <td>${ns.delivered + ns.read}</td>
      </tr>
      <tr>
        <td>Прочитано</td>
        <td>${ns.read}</td>
      </tr>
      <tr>
        <td>Ошибки отправки</td>
        <td>${ns.error}</td>
      </tr>
      ${ns.test_prepared > 0 ? `<tr><td>Тестовый режим (не отправлено)</td><td>${ns.test_prepared}</td></tr>` : ''}
    </tbody>
  </table>
`;
  }

  // Signatures section
  html += `
  <div class="signatures">
    <div class="signature-block">
      <div>Отчёт сформировал: <strong>${data.managerName || '________________'}</strong></div>
      <div class="signature-line"></div>
      <div class="signature-label">(подпись)</div>
    </div>
    <div class="signature-block">
      <div>Отчёт принял (руководитель):</div>
      <div class="signature-line"></div>
      <div class="signature-label">(подпись, ФИО)</div>
    </div>
  </div>

  <div class="footer">
    <div><strong>Сформировано:</strong> ${generatedAt}</div>
  </div>
</body>
</html>
`;

  return html;
}

export function printShiftReport(data: ExportShiftData, isDetailed: boolean): void {
  const html = generatePrintableHTML(data, isDetailed);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // No auto-print - user will click the button manually
  }
}

export function exportToExcel(data: ExportShiftData, isDetailed: boolean): void {
  const openedDate = format(new Date(data.openedAt), 'dd.MM.yyyy HH:mm', { locale: ru });
  const closedDate = data.closedAt 
    ? format(new Date(data.closedAt), 'dd.MM.yyyy HH:mm', { locale: ru })
    : 'Не закрыта';

  let csv = '\uFEFF'; // BOM for Excel UTF-8
  csv += `Отчёт по кассовой смене\n`;
  csv += `Открытие:;${openedDate}\n`;
  csv += `Закрытие:;${closedDate}\n\n`;

  csv += `Финансовые показатели\n`;
  csv += `Наличные;${data.incomeCash}\n`;
  csv += `Безнал;${data.incomeNonCash}\n`;
  csv += `Долги;${data.incomeDebt}\n`;
  csv += `Общая выручка;${data.totalRevenue}\n\n`;

  // Debt payment details in CSV
  if (data.debtPaymentDetails && data.debtPaymentDetails.length > 0) {
    csv += `Реестр принятых платежей по задолженностям\n`;
    csv += `№ Квитанции;Клиент;Основание;Дата долга;Оплата;Сумма\n`;
    const payMethodLabels: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', sbp: 'СБП' };
    data.debtPaymentDetails.forEach(p => {
      const debtDate = format(new Date(p.debt_date), 'dd.MM.yyyy', { locale: ru });
      const receiptNum = p.id ? p.id.substring(0, 8).toUpperCase() : '';
      csv += `${receiptNum};${p.client_name};${p.sale_description};${debtDate};${payMethodLabels[p.payment_method] || p.payment_method};${p.amount}\n`;
    });
    csv += `Итого погашение долгов;;;;;;;${Number(data.debtRepaymentTotal) || 0}\n\n`;
  }

  if (data.salesSummary.length > 0) {
    csv += `Страховые продукты\n`;
    csv += isDetailed 
      ? `Компания;Продукт;Кол-во;Нал;Безнал;Сумма\n`
      : `Компания;Продукт;Кол-во;Сумма\n`;
    data.salesSummary.forEach(item => {
      csv += isDetailed
        ? `${item.insurance_company || '—'};${item.product_name || '—'};${item.count};${item.total_cash};${item.total_non_cash};${item.total_amount}\n`
        : `${item.insurance_company || '—'};${item.product_name || '—'};${item.count};${item.total_amount}\n`;
    });
    csv += '\n';
  }

  if (data.servicesSummary.length > 0) {
    csv += `Услуги\n`;
    csv += isDetailed 
      ? `Услуга;Кол-во;Нал;Безнал;Сумма\n`
      : `Услуга;Кол-во;Сумма\n`;
    data.servicesSummary.forEach(item => {
      csv += isDetailed
        ? `${item.service_name};${item.count};${item.total_cash};${item.total_non_cash};${item.total_amount}\n`
        : `${item.service_name};${item.count};${item.total_amount}\n`;
    });
    csv += '\n';
  }

  if (isDetailed && data.transactions && data.transactions.length > 0) {
    csv += `Детализация операций\n`;
    csv += `Дата;№ Документа;Клиент;Тип;Наименование;Оплата;Сумма\n`;
    data.transactions.forEach(t => {
      csv += `${t.date};${t.uid};${t.clientName};${t.itemType};${t.itemName};${t.paymentMethod};${t.amount}\n`;
    });
    csv += '\n';
  }

  csv += `Касса\n`;
  csv += `Начальный остаток;${data.openingBalance}\n`;
  csv += `Приход наличными;${data.incomeCash}\n`;
  csv += `Конечный остаток;${data.closingBalance}\n`;
  csv += `Инкассация;${data.withdrawal}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `shift-report-${format(new Date(data.openedAt), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
