import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface DebtReceiptData {
  clientName: string;
  clientPhone?: string;
  saleUid: string;
  productName: string; // Полис или услуга, за которую погашается долг
  policyNumber?: string;
  amount: number;
  paymentMethod: 'cash' | 'card';
  paidAt: Date;
  managerName: string;
  remainingDebt: number;
  originalDebt: number;
}

export function printDebtReceipt(data: DebtReceiptData): void {
  const now = new Date();
  const paidAtFormatted = format(data.paidAt, 'dd.MM.yyyy HH:mm', { locale: ru });
  const generatedAt = format(now, 'dd.MM.yyyy в HH:mm:ss', { locale: ru });
  
  const paymentMethodLabel = data.paymentMethod === 'cash' ? 'Наличные' : 'Банковская карта';
  
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Квитанция о погашении долга</title>
  <style>
    @page { size: A5; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Arial', sans-serif; 
      font-size: 12px; 
      line-height: 1.5;
      color: #000;
      background: #fff;
      max-width: 148mm;
      margin: 0 auto;
      padding: 15px;
    }
    .header { 
      text-align: center; 
      border-bottom: 2px solid #000; 
      padding-bottom: 15px; 
      margin-bottom: 20px; 
    }
    .header h1 { 
      font-size: 16px; 
      font-weight: bold; 
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .subtitle {
      font-size: 11px;
      color: #333;
      margin-top: 5px;
    }
    .section { margin-bottom: 15px; }
    .section-title { 
      font-size: 11px; 
      font-weight: bold; 
      text-transform: uppercase; 
      color: #333;
      border-bottom: 1px solid #ccc;
      padding-bottom: 3px;
      margin-bottom: 8px;
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      padding: 4px 0;
      border-bottom: 1px dotted #ddd;
    }
    .row:last-child { border-bottom: none; }
    .row .label { color: #555; }
    .row .value { font-weight: 500; text-align: right; }
    .amount-box {
      background: #f5f5f5;
      border: 2px solid #000;
      padding: 15px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-box .label { 
      font-size: 10px; 
      text-transform: uppercase; 
      color: #555;
    }
    .amount-box .value { 
      font-size: 24px; 
      font-weight: bold; 
    }
    .remaining {
      text-align: center;
      padding: 10px;
      background: ${data.remainingDebt > 0 ? '#fff3e0' : '#e8f5e9'};
      border: 1px solid ${data.remainingDebt > 0 ? '#ffb74d' : '#4caf50'};
      margin-bottom: 20px;
    }
    .remaining .label { font-size: 10px; color: #555; }
    .remaining .value { 
      font-size: 14px; 
      font-weight: bold;
      color: ${data.remainingDebt > 0 ? '#e65100' : '#2e7d32'};
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
    }
    .signature-line {
      width: 45%;
      text-align: center;
    }
    .signature-line .line {
      border-bottom: 1px solid #000;
      height: 30px;
      margin-bottom: 5px;
    }
    .signature-line .label {
      font-size: 10px;
      color: #555;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Квитанция о погашении задолженности</h1>
    <div class="subtitle">Документ #${data.saleUid}</div>
  </div>

  <div class="section">
    <div class="section-title">Плательщик</div>
    <div class="row">
      <span class="label">ФИО / Название:</span>
      <span class="value">${data.clientName}</span>
    </div>
    ${data.clientPhone ? `
    <div class="row">
      <span class="label">Телефон:</span>
      <span class="value">${data.clientPhone}</span>
    </div>
    ` : ''}
  </div>

  <div class="section">
    <div class="section-title">Назначение платежа</div>
    <div class="row">
      <span class="label">Услуга / Продукт:</span>
      <span class="value">${data.productName}</span>
    </div>
    ${data.policyNumber ? `
    <div class="row">
      <span class="label">Номер полиса:</span>
      <span class="value">${data.policyNumber}</span>
    </div>
    ` : ''}
    <div class="row">
      <span class="label">Первоначальный долг:</span>
      <span class="value">${data.originalDebt.toLocaleString('ru-RU')} ₽</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Платёж</div>
    <div class="row">
      <span class="label">Дата и время:</span>
      <span class="value">${paidAtFormatted}</span>
    </div>
    <div class="row">
      <span class="label">Способ оплаты:</span>
      <span class="value">${paymentMethodLabel}</span>
    </div>
  </div>

  <div class="amount-box">
    <div class="label">Сумма платежа</div>
    <div class="value">${data.amount.toLocaleString('ru-RU')} ₽</div>
  </div>

  <div class="remaining">
    <div class="label">${data.remainingDebt > 0 ? 'Остаток задолженности' : 'Статус'}</div>
    <div class="value">${data.remainingDebt > 0 ? data.remainingDebt.toLocaleString('ru-RU') + ' ₽' : 'ПОГАШЕНО ПОЛНОСТЬЮ'}</div>
  </div>

  <div class="signatures">
    <div class="signature-line">
      <div class="line"></div>
      <div class="label">Подпись клиента</div>
    </div>
    <div class="signature-line">
      <div class="line"></div>
      <div class="label">Подпись менеджера</div>
    </div>
  </div>

  <div class="footer">
    <div>Принял: ${data.managerName}</div>
    <div>Сформировано: ${generatedAt}</div>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>
`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
