import * as XLSX from 'xlsx';

export function downloadErrorReport(errorDetails: string[]) {
  const wb = XLSX.utils.book_new();
  const data = [['№', 'Описание ошибки'], ...errorDetails.map((e, i) => [i + 1, e])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 6 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ошибки импорта');
  XLSX.writeFile(wb, 'Ошибки_импорта.xlsx');
}
