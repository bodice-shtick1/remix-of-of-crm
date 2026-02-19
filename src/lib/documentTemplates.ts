/**
 * Unified document templates — single source of truth for all document HTML generation.
 * Used by both the service forms (DKP constructor, Europrotocol constructor)
 * and the Document Archives print system.
 *
 * Each generator accepts structured data and returns a complete standalone HTML string.
 */

import { numberToWordsRub } from '@/lib/numberToWords';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// ─── Shared helpers ────────────────────────────────────────────

function formatDateRu(dateStr: string | undefined): string {
  if (!dateStr) return '«___» _______________ 20___г.';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return '«' + d.getDate() + '» ' + d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + ' г.';
  } catch { return dateStr; }
}

function v(val?: string, placeholder = '_'.repeat(30)): string {
  const t = val?.trim();
  return t ? `<b>${esc(t)}</b>` : placeholder;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function b(val: string | undefined, placeholder = '_'.repeat(30)): string {
  return val?.trim() ? `<strong>${esc(val.trim())}</strong>` : placeholder;
}

// ─── DKP (Договор купли-продажи ТС) ───────────────────────────

export interface DkpTemplateData {
  seller: {
    fullName: string;
    passportSeries: string;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    passportUnitCode: string;
    address: string;
    phone: string;
  };
  buyer: {
    fullName: string;
    passportSeries: string;
    passportNumber: string;
    passportIssuedBy: string;
    passportIssueDate: string;
    passportUnitCode: string;
    address: string;
    phone: string;
  };
  vehicle: {
    brand: string;
    model: string;
    year: string;
    vin: string;
    bodyNumber: string;
    engineNumber: string;
    color: string;
    regPlate: string;
    ptsNumber: string;
    ptsDate: string;
    ptsIssuedBy: string;
    isEpts: boolean;
    stsNumber: string;
    stsDate: string;
    stsIssuedBy: string;
    vehicleType: string;
    vehicleCategory: string;
    mileage: string;
    enginePower: string;
    chassisNumber: string;
  };
  price: number;
  contractDate: string;
  contractCity: string;
}

function fmtPassportHtml(p: { passportSeries: string; passportNumber: string; passportIssuedBy: string; passportIssueDate: string; passportUnitCode: string }): string {
  const parts: string[] = [];
  parts.push(`серии ${v(p.passportSeries, '_______')} № ${v(p.passportNumber, '__________________')}`);
  if (p.passportIssueDate || p.passportIssuedBy) {
    parts.push(`, выдан ${p.passportIssueDate ? `<b>${esc(formatDateRu(p.passportIssueDate))}</b>` : '«____» ___________________________ г.'}`);
    if (p.passportIssuedBy) parts.push(`, ${v(p.passportIssuedBy)}`);
  }
  if (p.passportUnitCode) parts.push(`, код подразделения ${v(p.passportUnitCode)}`);
  return parts.join('');
}

function fmtDocLine(num: string, date: string, issuedBy: string): string {
  const parts: string[] = [];
  if (num.trim()) parts.push(esc(num.trim()));
  if (date) parts.push(formatDateRu(date));
  if (issuedBy.trim()) parts.push(esc(issuedBy.trim()));
  return parts.join(', ');
}

const GOST_DKP_STYLES = `
@page { size: A4 portrait; margin: 20mm 10mm 20mm 30mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: white; }
body {
  font-family: "Times New Roman", "Liberation Serif", Georgia, serif;
  font-size: 12pt;
  line-height: 1.15;
  color: #000;
  padding: 20mm 10mm 20mm 30mm;
  max-width: 210mm;
  margin: 0 auto;
}
h1 {
  font-size: 14pt;
  font-weight: bold;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
  margin-bottom: 4pt;
}
.subtitle { text-align: center; font-size: 12pt; margin-bottom: 14pt; }
.date-city { display: flex; justify-content: space-between; font-size: 12pt; margin-bottom: 14pt; }
p { text-align: justify; text-indent: 1.25cm; margin-bottom: 6pt; }
p.no-indent { text-indent: 0; }
.section-title { font-weight: bold; text-indent: 1.25cm; margin-top: 12pt; margin-bottom: 4pt; text-align: justify; }
table.vehicle-info { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt 0; }
table.vehicle-info td { border: 1px solid #000; padding: 3pt 6pt; font-size: 11pt; vertical-align: top; }
table.vehicle-info td:first-child { width: 45%; }
.sigs { display: flex; justify-content: space-between; margin-top: 30pt; page-break-inside: avoid; }
.sig-block { width: 45%; }
.sig-line { border-bottom: 1px solid #000; margin-top: 20pt; margin-bottom: 3pt; min-height: 16pt; }
.sig-caption { text-align: center; font-size: 9pt; color: #555; }
`;

export function generateDkpHTML(data: DkpTemplateData): string {
  const { seller, buyer, vehicle, price, contractDate, contractCity } = data;

  const vehicleRows: [string, string][] = [
    ['Марка, модель ТС', `${vehicle.brand} ${vehicle.model}`.trim()],
    ['Идентификационный номер (VIN)', vehicle.vin],
    ['Гос. регистрационный номер', vehicle.regPlate],
    ['Тип ТС', vehicle.vehicleType],
    ['Категория ТС', vehicle.vehicleCategory],
    ['Год выпуска', vehicle.year],
    ['Пробег', vehicle.mileage ? `${vehicle.mileage} км` : ''],
    ['Мощность и объём двигателя', vehicle.enginePower],
    ['Цвет кузова', vehicle.color],
    ['Модель и номер двигателя', vehicle.engineNumber],
    ['Номер шасси (рамы)', vehicle.chassisNumber],
    ['Номер кузова', vehicle.bodyNumber],
  ];

  const ptsLabel = vehicle.isEpts ? 'Паспорт (электронный паспорт)' : 'Паспорт';
  const stsVal = fmtDocLine(vehicle.stsNumber, vehicle.stsDate, vehicle.stsIssuedBy);
  const ptsVal = fmtDocLine(vehicle.ptsNumber, vehicle.ptsDate, vehicle.ptsIssuedBy);

  const priceNum = price > 0 ? price.toLocaleString('ru-RU') : '__________';
  let priceText = '';
  try { priceText = price > 0 ? numberToWordsRub(price) : ''; } catch {}

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ДКП</title>
<style>${GOST_DKP_STYLES}</style></head><body>

<h1>ДОГОВОР КУПЛИ-ПРОДАЖИ</h1>
<p class="subtitle no-indent">транспортного средства</p>

<div class="date-city">
  <span>${contractDate ? `<b>${esc(formatDateRu(contractDate))}</b>` : '«___» _______________ 20___г.'}</span>
  <span>г.&nbsp;${v(contractCity, '______________________________')}</span>
</div>

<p>Мы, нижеподписавшиеся:</p>

<p>гр. ${v(seller.fullName, '_'.repeat(50))}, паспорт: ${fmtPassportHtml(seller)}, зарегистрированный(ая) по адресу: ${v(seller.address, '_'.repeat(50))}, тел.: ${v(seller.phone, '_'.repeat(20))}, именуемый(ая) в дальнейшем «<b>Продавец</b>», с одной стороны,</p>

<p>и гр. ${v(buyer.fullName, '_'.repeat(50))}, паспорт: ${fmtPassportHtml(buyer)}, зарегистрированный(ая) по адресу: ${v(buyer.address, '_'.repeat(50))}, тел.: ${v(buyer.phone, '_'.repeat(20))}, именуемый(ая) в дальнейшем «<b>Покупатель</b>», с другой стороны,</p>

<p>совместно именуемые «Стороны», а по отдельности — «Сторона», заключили настоящий Договор о нижеследующем:</p>

<p class="section-title">1. Предмет Договора</p>
<p>1.1. Продавец передал в собственность Покупателя, а Покупатель принял и оплатил транспортное средство (далее — ТС) со следующими характеристиками:</p>

<table class="vehicle-info"><tbody>
${vehicleRows.map(([label, val]) => `<tr><td>${esc(label)}</td><td>${val?.trim() ? `<b>${esc(val.trim())}</b>` : '_'.repeat(30)}</td></tr>`).join('')}
<tr><td>Свидетельство о регистрации (СТС)</td><td>${stsVal ? `<b>${esc(stsVal)}</b>` : '_'.repeat(30)}</td></tr>
<tr><td>${esc(ptsLabel)} ТС</td><td>${ptsVal ? `<b>${esc(ptsVal)}</b>` : '_'.repeat(30)}</td></tr>
</tbody></table>

<p class="section-title">2. Стоимость и порядок расчётов</p>
<p>2.1. Стоимость ТС составляет: <b>${priceNum}</b> (${priceText ? `<b>${esc(priceText)}</b>` : '_'.repeat(40)}) руб. 00 коп. Денежные средства переданы Покупателем и приняты Продавцом в полном объёме.</p>
<p>2.2. ТС передано Продавцом и принято Покупателем при заключении настоящего Договора. Претензий по техническому состоянию и качеству ТС Покупатель не имеет. Отдельный акт приёма-передачи Сторонами не составляется.</p>

<p class="section-title">3. Гарантии и ответственность Сторон</p>
<p>3.1. Продавец гарантирует, что обладает всеми необходимыми правами на продажу ТС; ТС не продано, не подарено, не заложено, в споре и под арестом не состоит; ограничения в использовании ТС отсутствуют; ТС не является предметом обязательств перед третьими лицами, не находится в залоге, в отношении ТС не наложен запрет на совершение регистрационных действий, ТС не числится в базах данных МВД России как угнанное или похищенное и не имеет иных обременений.</p>
<p>3.2. В случае нарушения гарантий п.&nbsp;3.1 или сообщения заведомо ложных сведений Продавец обязуется незамедлительно возвратить Покупателю стоимость ТС в полном объёме.</p>
<p>3.3. Покупатель обязуется в течение 10 (десяти) календарных дней со дня подписания Договора осуществить регистрацию ТС в МВД России.</p>
<p>3.4. В случае неисполнения п.&nbsp;3.3 Продавец вправе направить заявление о прекращении государственного учёта ТС, в том числе через портал Госуслуг.</p>
<p>3.5. Стороны согласны, что информация, указанная в Договоре, может быть передана в МВД России.</p>

<p class="section-title">4. Заключительные положения</p>
<p>4.1. Настоящий Договор составлен в трёх идентичных экземплярах, имеющих равную юридическую силу: по одному для каждой из Сторон, третий — для передачи в МВД России.</p>
<p>4.2. Договор вступает в силу после его подписания Сторонами.</p>
<p>4.3. Покупатель и Продавец подтверждают, что не состоят под опекой и попечительством, не страдают заболеваниями, препятствующими осознать суть Договора, а также отсутствуют обстоятельства, вынуждающие совершить данный Договор на крайне невыгодных условиях.</p>

<div class="sigs">
  <div class="sig-block">
    <p class="no-indent"><b>Продавец:</b></p>
    <div class="sig-line">${seller.fullName ? `<b>${esc(seller.fullName)}</b>` : ''}</div>
    <p class="sig-caption no-indent">(ФИО)</p>
    <div class="sig-line">&nbsp;</div>
    <p class="sig-caption no-indent">(подпись)</p>
  </div>
  <div class="sig-block">
    <p class="no-indent"><b>Покупатель:</b></p>
    <div class="sig-line">${buyer.fullName ? `<b>${esc(buyer.fullName)}</b>` : ''}</div>
    <p class="sig-caption no-indent">(ФИО)</p>
    <div class="sig-line">&nbsp;</div>
    <p class="sig-caption no-indent">(подпись)</p>
  </div>
</div>

</body></html>`;
}

// ─── PND Consent (Согласие ПДН) ────────────────────────────────

export interface PndTemplateData {
  clientName: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssueDate?: string;
  address?: string;
  phone?: string;
  organizationName: string;
  organizationInn?: string;
  organizationAddress?: string;
  date: string;
}

const GOST_PND_STYLES = `
@page { size: A4 portrait; margin: 20mm 10mm 20mm 30mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: white; }
body {
  font-family: "Times New Roman", "Liberation Serif", Georgia, serif;
  font-size: 14pt;
  line-height: 1.5;
  color: #000;
  padding: 20mm 10mm 20mm 30mm;
  max-width: 210mm;
  margin: 0 auto;
}
h1 {
  font-size: 14pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: 2pt;
}
.law-ref { text-align: center; font-size: 10pt; color: #444; margin-bottom: 18pt; }
p { text-align: justify; text-indent: 1.25cm; margin-bottom: 6pt; }
p.no-indent { text-indent: 0; }
.section-num { font-weight: bold; }
.sig-row { display: flex; justify-content: space-between; margin-top: 30pt; page-break-inside: avoid; }
.sig-block { width: 45%; }
.sig-line { border-bottom: 1px solid #000; margin-top: 20pt; margin-bottom: 3pt; min-height: 16pt; }
.sig-caption { text-align: center; font-size: 9pt; color: #555; }
`;

export function generatePndHTML(data: PndTemplateData): string {
  const passportLine = [
    data.passportSeries ? `серия ${b(data.passportSeries)}` : '',
    data.passportNumber ? `№ ${b(data.passportNumber)}` : '',
    data.passportIssuedBy ? `выдан ${b(data.passportIssuedBy)}` : '',
    data.passportIssueDate ? formatDateRu(data.passportIssueDate) : '',
  ].filter(Boolean).join(', ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Согласие на обработку ПД — ${esc(data.clientName)}</title>
<style>${GOST_PND_STYLES}</style></head><body>

<h1>СОГЛАСИЕ</h1>
<h1 style="margin-bottom:6pt;">на обработку персональных данных</h1>
<p class="law-ref no-indent">(в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных»)</p>

<p>Я, ${b(data.clientName)}, паспорт: ${passportLine || '_'.repeat(60)}, зарегистрированный(ая) по адресу: ${b(data.address)}, телефон: ${b(data.phone)},</p>

<p>даю своё согласие ${b(data.organizationName)}${data.organizationInn ? ` (ИНН: ${b(data.organizationInn)})` : ''}${data.organizationAddress ? `, адрес: ${b(data.organizationAddress)}` : ''} (далее — «Оператор») на обработку моих персональных данных на следующих условиях:</p>

<p><span class="section-num">1. Перечень персональных данных:</span> фамилия, имя, отчество; дата и место рождения; паспортные данные (серия, номер, дата выдачи, кем выдан, код подразделения); адрес регистрации и фактического проживания; номер телефона; адрес электронной почты; ИНН; данные о транспортных средствах (марка, модель, VIN, государственный регистрационный номер); сведения о договорах страхования.</p>

<p><span class="section-num">2. Цели обработки:</span> заключение и исполнение договоров страхования и купли-продажи; ведение клиентской базы; информирование о сроках действия полисов, задолженностях и акциях; оформление документов; соблюдение требований законодательства Российской Федерации.</p>

<p><span class="section-num">3. Способы обработки:</span> сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (распространение, предоставление, доступ), обезличивание, блокирование, удаление, уничтожение персональных данных — как с использованием средств автоматизации, так и без них.</p>

<p><span class="section-num">4. Согласие на получение уведомлений и рассылок.</span> Я даю согласие на получение информационных, сервисных и рекламных сообщений (уведомления о сроках полисов, задолженностях, акциях и специальных предложениях) посредством мессенджеров (включая WhatsApp, Telegram и иные), SMS-сообщений, электронной почты и телефонных звонков.</p>

<p>Я понимаю, что могу в любое время отозвать данное согласие на получение рассылок, направив письменное уведомление Оператору.</p>

<p><span class="section-num">5. Срок действия согласия:</span> настоящее согласие действует бессрочно до момента его отзыва путём направления письменного уведомления Оператору.</p>

<p><span class="section-num">6. Порядок отзыва:</span> согласие может быть отозвано субъектом персональных данных путём направления письменного заявления Оператору. Отзыв согласия не влияет на законность обработки, произведённой до момента отзыва.</p>

<div class="sig-row">
  <div class="sig-block">
    <p class="no-indent">${formatDateRu(data.date)}</p>
  </div>
  <div class="sig-block">
    <div class="sig-line">&nbsp;</div>
    <p class="sig-caption no-indent">(подпись / расшифровка)</p>
  </div>
</div>

</body></html>`;
}

/** Returns only the inner body fragment (for embedding in multi-page prints) */
export function generatePndBodyFragment(data: PndTemplateData): string {
  const full = generatePndHTML(data);
  const bodyStart = full.indexOf('<body>');
  const bodyEnd = full.lastIndexOf('</body>');
  if (bodyStart >= 0 && bodyEnd >= 0) return full.slice(bodyStart + 6, bodyEnd);
  return full;
}

// ─── Shared Receipt Data ───────────────────────────────────────

export interface ReceiptTemplateData {
  uid: string;
  date: string;
  clientName: string;
  clientPhone?: string;
  paymentMethod: string;
  agentName?: string;
  items: Array<{
    type: string;
    productName?: string;
    serviceName?: string;
    series?: string;
    number?: string;
    vehicleBrand?: string;
    vehicleNumber?: string;
    startDate?: string;
    endDate?: string;
    premiumAmount: number;
    quantity?: number;
    unitPrice?: number;
  }>;
  total: number;
  roundingAmount?: number;
}

const paymentLabels: Record<string, string> = {
  cash: 'Наличные', card: 'Банковская карта', sbp: 'СБП', transfer: 'Банковский перевод', debt: 'В долг',
};

function fmtAmt(n: number): string { return n.toFixed(2).replace('.', ','); }

function fmtDateShort(d: string | undefined): string {
  if (!d) return '—';
  try { return format(new Date(d), 'dd.MM.yyyy'); } catch { return d; }
}

// ─── Cash Receipt (Кассовый чек — 80mm лента) ─────────────────

export function generateCashReceiptHTML(data: ReceiptTemplateData): string {
  let dateStr = '';
  try { dateStr = data.date ? format(new Date(data.date), 'dd.MM.yyyy HH:mm', { locale: ru }) : ''; } catch {}

  const items = (data.items || []).filter(i => i.type !== 'rounding');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Кассовый чек ${esc(data.uid || '')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:80mm auto;margin:5mm}
@media print{body{padding:0}.no-print{display:none!important}}
body{font-family:'Courier New','Liberation Mono',monospace;font-size:12px;line-height:1.4;padding:5mm;max-width:80mm;margin:0 auto;color:#000;background:white}
.header{text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px}
.title{font-weight:bold;font-size:14px;letter-spacing:1px;margin-bottom:4px}
.info{margin:8px 0}
.info-row{display:flex;justify-content:space-between;margin:2px 0;font-size:11px}
.items{margin:8px 0;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0}
.item{margin:6px 0}
.item-name{font-weight:bold;font-size:12px}
.item-detail{font-size:10px;color:#333}
.item-price{display:flex;justify-content:space-between;font-size:12px;margin-top:2px}
.sep{border-top:1px dashed #000;margin:4px 0}
.total{font-weight:bold;font-size:16px;text-align:right;margin:8px 0;letter-spacing:0.5px}
.rounding{display:flex;justify-content:space-between;font-size:10px;color:#555}
.qr{text-align:center;margin:12px 0;padding:10px;border:2px solid #000}
.qr-label{font-size:9px;color:#555;margin-top:4px}
.footer{text-align:center;margin-top:10px;font-size:10px;color:#555;border-top:1px dashed #000;padding-top:8px}
</style></head><body>

<div class="header">
  <div class="title">КАССОВЫЙ ЧЕК</div>
  <div style="font-size:10px">СтрахАгент CRM</div>
</div>

<div class="info">
  <div class="info-row"><span>Док.:</span><span>${esc(data.uid || '—')}</span></div>
  <div class="info-row"><span>Дата:</span><span>${dateStr}</span></div>
  <div class="info-row"><span>Клиент:</span><span>${esc(data.clientName || '—')}</span></div>
  ${data.clientPhone ? `<div class="info-row"><span>Тел.:</span><span>${esc(data.clientPhone)}</span></div>` : ''}
  <div class="info-row"><span>Оплата:</span><span>${paymentLabels[data.paymentMethod] || esc(data.paymentMethod || '—')}</span></div>
</div>

<div class="items">
${items.map(item => {
  const name = item.type === 'insurance' ? esc(item.productName || 'Полис') : esc(item.serviceName || 'Услуга');
  let details = '';
  if (item.type === 'insurance') {
    if (item.series || item.number) details += `<div class="item-detail">Полис: ${esc((item.series || '') + ' ' + (item.number || ''))}</div>`;
    if (item.vehicleBrand || item.vehicleNumber) details += `<div class="item-detail">Авто: ${esc(item.vehicleBrand || '')} ${esc(item.vehicleNumber || '')}</div>`;
    if (item.startDate || item.endDate) details += `<div class="item-detail">${fmtDateShort(item.startDate)} — ${fmtDateShort(item.endDate)}</div>`;
  } else if (item.quantity && item.quantity > 1) {
    details += `<div class="item-detail">${item.quantity} × ${fmtAmt(item.unitPrice || item.premiumAmount)} ₽</div>`;
  }
  return `<div class="item"><div class="item-name">${name}</div>${details}<div class="item-price"><span></span><span>${fmtAmt(item.premiumAmount || 0)} ₽</span></div></div>`;
}).join('')}
</div>

${data.roundingAmount ? `<div class="rounding"><span>Округление:</span><span>${fmtAmt(Number(data.roundingAmount))} ₽</span></div>` : ''}
<div class="total">ИТОГО: ${fmtAmt(Number(data.total))} ₽</div>

<div class="qr">
  <div style="font-size:11px;font-weight:bold">[ QR ]</div>
  <div class="qr-label">${esc(data.uid || '')}</div>
</div>

<div class="footer">
  <p>Спасибо за обращение!</p>
  ${data.agentName ? `<p>${esc(data.agentName)}</p>` : ''}
  <p style="margin-top:4px;font-size:9px">${dateStr}</p>
</div>

</body></html>`;
}

/** Backward-compatible alias */
export const generateReceiptHTML = generateCashReceiptHTML;

// ─── Sales Receipt (Товарный чек — А4) ────────────────────────

export function generateSalesReceiptHTML(data: ReceiptTemplateData): string {
  let dateStr = '';
  try { dateStr = data.date ? format(new Date(data.date), 'dd MMMM yyyy г., HH:mm', { locale: ru }) : ''; } catch {}

  const items = (data.items || []).filter(i => i.type !== 'rounding');
  let priceWords = '';
  try { priceWords = data.total > 0 ? numberToWordsRub(data.total) : ''; } catch {}

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Товарный чек ${esc(data.uid || '')}</title>
<style>
@page{size:A4 portrait;margin:20mm 10mm 20mm 30mm}
@media print{html,body{margin:0!important;padding:0!important}.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:white}
body{font-family:"Times New Roman","Liberation Serif",Georgia,serif;font-size:12pt;line-height:1.15;color:#000;padding:20mm 10mm 20mm 30mm;max-width:210mm;margin:0 auto}
h1{font-size:14pt;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:0.5pt;margin-bottom:4pt}
.subtitle{text-align:center;font-size:12pt;margin-bottom:14pt}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6pt 20pt;margin-bottom:14pt;font-size:11pt}
.info-grid .label{color:#555;font-size:10pt}
.info-grid .value{font-weight:bold}
table{width:100%;border-collapse:collapse;margin:12pt 0}
th,td{border:1px solid #000;padding:4pt 6pt;vertical-align:top;font-size:11pt}
th{background:#f0f0f0;font-weight:bold;font-size:10pt;text-align:center}
td.num{text-align:center}
td.amt{text-align:right;white-space:nowrap}
.rounding-row{font-style:italic;color:#555}
.total-row{font-weight:bold;font-size:12pt;background:#f5f9ff}
.total-row td{padding:6pt}
.total-words{margin-top:8pt;font-size:11pt;text-indent:1.25cm;text-align:justify}
.sigs{display:flex;justify-content:space-between;margin-top:30pt;page-break-inside:avoid}
.sig-block{width:45%}
.sig-line{border-bottom:1px solid #000;margin-top:20pt;margin-bottom:3pt;min-height:16pt}
.sig-caption{text-align:center;font-size:9pt;color:#555}
.gen-info{font-size:9pt;color:#888;margin-top:16pt}
</style></head><body>

<h1>ТОВАРНЫЙ ЧЕК</h1>
<p class="subtitle">№ ${esc(data.uid || '—')}</p>

<div class="info-grid">
  <div><div class="label">Дата и время</div><div class="value">${dateStr}</div></div>
  <div><div class="label">Клиент</div><div class="value">${esc(data.clientName || '—')}</div></div>
  ${data.clientPhone ? `<div><div class="label">Телефон</div><div class="value">${esc(data.clientPhone)}</div></div>` : '<div></div>'}
  <div><div class="label">Способ оплаты</div><div class="value">${paymentLabels[data.paymentMethod] || esc(data.paymentMethod || '—')}</div></div>
</div>

<table>
<thead><tr>
  <th style="width:5%">№</th>
  <th style="width:35%">Наименование</th>
  <th style="width:15%">Полис / Период</th>
  <th style="width:10%">Кол-во</th>
  <th style="width:15%">Цена</th>
  <th style="width:15%">Сумма</th>
</tr></thead>
<tbody>
${items.map((item, i) => {
  const isIns = item.type === 'insurance';
  const name = isIns ? esc(item.productName || 'Полис') : esc(item.serviceName || 'Услуга');
  const policy = isIns && (item.series || item.number) ? esc(`${item.series || ''} ${item.number || ''}`.trim()) : '—';
  const qty = isIns ? '1' : String(item.quantity || 1);
  const unitPrice = isIns ? fmtAmt(item.premiumAmount) : fmtAmt(item.unitPrice || item.premiumAmount);
  return `<tr>
    <td class="num">${i + 1}</td>
    <td>${name}${isIns && (item.vehicleBrand || item.vehicleNumber) ? `<br/><span style="font-size:10pt;color:#444">${esc(item.vehicleBrand || '')} ${esc(item.vehicleNumber || '')}</span>` : ''}</td>
    <td>${policy}${isIns && (item.startDate || item.endDate) ? `<br/><span style="font-size:9pt">${fmtDateShort(item.startDate)}—${fmtDateShort(item.endDate)}</span>` : ''}</td>
    <td class="num">${qty}</td>
    <td class="amt">${unitPrice} ₽</td>
    <td class="amt">${fmtAmt(item.premiumAmount || 0)} ₽</td>
  </tr>`;
}).join('')}
${data.roundingAmount ? `<tr class="rounding-row"><td class="num">—</td><td colspan="4">Округление</td><td class="amt">${fmtAmt(Number(data.roundingAmount))} ₽</td></tr>` : ''}
<tr class="total-row"><td colspan="5" style="text-align:right">ИТОГО К ОПЛАТЕ:</td><td class="amt">${fmtAmt(Number(data.total))} ₽</td></tr>
</tbody>
</table>

${priceWords ? `<p class="total-words">Итого: <b>${esc(priceWords)}</b></p>` : ''}

<div class="sigs">
  <div class="sig-block">
    <div class="sig-line">${data.agentName ? esc(data.agentName) : ''}</div>
    <div class="sig-caption">Агент / Продавец</div>
  </div>
  <div class="sig-block">
    <div class="sig-line">&nbsp;</div>
    <div class="sig-caption">Подпись клиента</div>
  </div>
</div>

<p class="gen-info">Сформировано: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}</p>

</body></html>`;
}

// ─── Europrotocol ──────────────────────────────────────────────
export { buildEuroprotocolHTML as generateEuroprotocolHTML } from '@/components/europrotocol/europrotocolHtmlBuilder';

// ─── Unified print helper ──────────────────────────────────────

export function printDocumentHTML(html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}
