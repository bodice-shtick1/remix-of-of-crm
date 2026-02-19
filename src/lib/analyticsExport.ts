import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { PeriodType } from '@/hooks/useAnalyticsData';
import { addCyrillicFont } from '@/lib/cyrillicFont';

const periodLabels: Record<PeriodType, string> = {
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
};

export function generateAnalyticsPdf(
  data: {
    totalRevenue: number;
    expectedIncome: number;
    topCompany: string;
    salesCount: number;
    policiesCount: number;
    channelData: { name: string; value: number }[];
    upcomingPayments: any[];
  },
  period: PeriodType
) {
  const doc = new jsPDF();
  addCyrillicFont(doc);

  const today = format(new Date(), 'd MMMM yyyy', { locale: ru });

  doc.setFontSize(18);
  doc.text('Аналитический отчёт', 14, 20);
  doc.setFontSize(10);
  doc.text(`Период: ${periodLabels[period]} | Дата: ${today}`, 14, 28);

  doc.setFontSize(12);
  let y = 42;
  const line = (label: string, value: string) => {
    doc.text(`${label}: ${value}`, 14, y);
    y += 8;
  };

  line('Выручка', `${data.totalRevenue.toLocaleString('ru-RU')} тг`);
  line('Ожидаемые поступления', `${data.expectedIncome.toLocaleString('ru-RU')} тг`);
  line('Количество продаж', String(data.salesCount));
  line('Количество полисов', String(data.policiesCount));
  line('Топ страховая компания', data.topCompany);

  y += 4;
  doc.setFontSize(14);
  doc.text('Каналы связи', 14, y);
  y += 8;
  doc.setFontSize(11);
  data.channelData.forEach(ch => {
    doc.text(`${ch.name}: ${ch.value} сообщений`, 14, y);
    y += 7;
  });

  if (data.upcomingPayments.length > 0) {
    y += 6;
    doc.setFontSize(14);
    doc.text('Ближайшие выплаты', 14, y);
    y += 8;
    doc.setFontSize(10);
    data.upcomingPayments.slice(0, 15).forEach((p: any) => {
      const client = p.clients;
      const name = client ? `${client.last_name} ${client.first_name}` : '—';
      const debt = Number(p.total_amount) - Number(p.amount_paid);
      doc.text(`${name} — ${debt.toLocaleString('ru-RU')} тг — ${p.installment_due_date || '—'}`, 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });
  }

  doc.save(`analytics-${period}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
