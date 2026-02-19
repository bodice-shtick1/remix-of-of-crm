import * as XLSX from 'xlsx';

const TEMPLATE_COLUMNS = [
  'Дата',
  'ФИО',
  'Телефон',
  'Продукт',
  'СК',
  'Серия',
  'Номер',
  'Срок начала',
  'Срок конца',
  'Госномер',
  'VIN',
  'Марка',
  'Модель',
  'Стоимость полиса',
  'Получено денег',
];

const SAMPLE_ROWS = [
  ['01.03.2025', 'Иванов Иван Иванович', '+7 (999) 123-45-67', 'ОСАГО', 'Росгосстрах', 'ХХХ', '1234567890', '01.03.2025', '28.02.2026', 'А123АА77', 'XTA21140050123456', 'Lada', 'Granta', 45000, 45000],
  ['15.03.2025', 'Петрова Мария Сергеевна', '+7 (912) 987-65-43', 'КАСКО', 'Ингосстрах', 'ККК', '9876543210', '15.03.2025', '14.03.2026', 'В456ВВ99', 'WVWZZZ3CZWE123456', 'Volkswagen', 'Tiguan', 120000, 80000],
];

export function downloadSalesTemplate() {
  const wb = XLSX.utils.book_new();
  const wsData = [TEMPLATE_COLUMNS, ...SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = TEMPLATE_COLUMNS.map((col) => ({
    wch: Math.max(col.length, 16),
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'История продаж');
  XLSX.writeFile(wb, 'Шаблон_История_продаж.xlsx');
}
