import { numberToWordsRub } from '@/lib/numberToWords';

export interface DkpParty {
  fullName: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuedBy: string;
  passportIssueDate: string;
  passportUnitCode: string;
  address: string;
  phone: string;
}

export interface DkpVehicle {
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
}

export interface DkpData {
  seller: DkpParty;
  buyer: DkpParty;
  vehicle: DkpVehicle;
  price: number;
  contractDate: string;
  contractCity: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '«___» _______________ 20___г.';
  try {
    const d = new Date(dateStr);
    return '«' + d.getDate() + '» ' + d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) + ' г.';
  } catch { return dateStr; }
}

function B({ children }: { children: React.ReactNode }) {
  return <strong>{children}</strong>;
}

function val(value: string | undefined, placeholder = '_'.repeat(30)): React.ReactNode {
  const v = value?.trim();
  if (v) return <B>{v}</B>;
  return placeholder;
}

export function DkpPreview({ data }: { data: DkpData }) {
  const priceText = data.price > 0 ? numberToWordsRub(data.price) : '';
  const priceNum = data.price > 0 ? data.price.toLocaleString('ru-RU') : '__________';

  const ptsLabel = data.vehicle.isEpts ? 'Паспорт (электронный паспорт)' : 'Паспорт';

  const vehicleRows: [string, string][] = [
    ['Марка, модель ТС', `${data.vehicle.brand} ${data.vehicle.model}`.trim()],
    ['Идентификационный номер (VIN)', data.vehicle.vin],
    ['Гос. регистрационный номер', data.vehicle.regPlate],
    ['Тип ТС', data.vehicle.vehicleType],
    ['Категория ТС', data.vehicle.vehicleCategory],
    ['Год выпуска', data.vehicle.year],
    ['Пробег', data.vehicle.mileage ? `${data.vehicle.mileage} км` : ''],
    ['Мощность и объём двигателя', data.vehicle.enginePower],
    ['Цвет кузова', data.vehicle.color],
    ['Модель и номер двигателя', data.vehicle.engineNumber],
    ['Номер шасси (рамы)', data.vehicle.chassisNumber],
    ['Номер кузова', data.vehicle.bodyNumber],
  ];

  const fmtDocLine = (num: string, date: string, issuedBy: string) => {
    const parts: string[] = [];
    if (num.trim()) parts.push(num.trim());
    if (date) parts.push(formatDate(date));
    if (issuedBy.trim()) parts.push(issuedBy.trim());
    return parts.join(', ');
  };

  const stsVal = fmtDocLine(data.vehicle.stsNumber, data.vehicle.stsDate, data.vehicle.stsIssuedBy);
  const ptsVal = fmtDocLine(data.vehicle.ptsNumber, data.vehicle.ptsDate, data.vehicle.ptsIssuedBy);

  const fmtPassport = (p: DkpParty) => {
    const parts: React.ReactNode[] = [];
    parts.push(<>серии {val(p.passportSeries, '_______')} № {val(p.passportNumber, '__________________')}</>);
    if (p.passportIssueDate || p.passportIssuedBy) {
      parts.push(<>, выдан {p.passportIssueDate ? <B>{formatDate(p.passportIssueDate)}</B> : '«____» ___________________________ г.'}</>);
      if (p.passportIssuedBy) parts.push(<>, {val(p.passportIssuedBy)}</>);
    }
    if (p.passportUnitCode) parts.push(<>, код подразделения {val(p.passportUnitCode)}</>);
    return parts;
  };

  return (
    <div id="dkp-print-area" className="dkp-document bg-white text-black p-[40px] font-serif text-[12px] leading-[1.6] max-w-[210mm] mx-auto shadow-lg" style={{ fontFamily: '"Times New Roman", "Noto Serif", Georgia, serif' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-[15px] font-bold tracking-wide uppercase mb-1">
          Договор купли-продажи<br />транспортного средства
        </h1>
      </div>

      <div className="flex justify-between text-[11px] mb-4">
        <span>{data.contractDate ? <B>{formatDate(data.contractDate)}</B> : '«___» _______________ 20___г.'}</span>
        <span>{val(data.contractCity, '______________________________')}</span>
      </div>

      {/* Parties */}
      <p className="text-justify mb-2">
        Мы, гр. {val(data.seller.fullName, '_'.repeat(50))}, паспорт: {fmtPassport(data.seller)}, адрес: {val(data.seller.address, '_'.repeat(60))}, именуемый(ая) в дальнейшем «Продавец»,
      </p>

      <p className="text-justify mb-2">
        и гр. {val(data.buyer.fullName, '_'.repeat(50))}, паспорт: {fmtPassport(data.buyer)}, адрес: {val(data.buyer.address, '_'.repeat(60))}, именуемый(ая) в дальнейшем «Покупатель»,
      </p>

      <p className="text-justify mb-4">
        совместно именуемые «Стороны», а по отдельности — «Сторона», заключили настоящий Договор (далее — Договор) о нижеследующем:
      </p>

      {/* 1. Subject */}
      <p className="font-bold mb-1">1. Предмет Договора</p>
      <p className="text-justify mb-2">
        1.1. Продавец передал в собственность Покупателя, а Покупатель принял и оплатил транспортное средство:
      </p>

      <table className="w-full mb-4 text-[11px] border-collapse">
        <tbody>
          {vehicleRows.map(([label, v]) => (
            <tr key={label}>
              <td className="py-0.5 pr-2 text-right w-[180px] text-[10px]" style={{ color: '#666' }}>{label}:</td>
              <td className="py-0.5">{v?.trim() ? <B>{v.trim()}</B> : '_'.repeat(40)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-0.5 pr-2 text-right w-[180px] text-[10px]" style={{ color: '#666' }}>Свидетельство о регистрации (СТС):</td>
            <td className="py-0.5">{stsVal ? <B>{stsVal}</B> : '_'.repeat(40)}</td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 text-right w-[180px] text-[10px]" style={{ color: '#666' }}>{ptsLabel} ТС:</td>
            <td className="py-0.5">{ptsVal ? <B>{ptsVal}</B> : '_'.repeat(40)}</td>
          </tr>
        </tbody>
      </table>

      {/* 2. Cost */}
      <p className="font-bold mb-1">2. Стоимость, порядок расчётов и передачи транспортного средства</p>
      <p className="text-justify mb-2">
        2.1. Стоимость транспортного средства составляет: <B>{priceNum}</B> ({priceText ? <B>{priceText}</B> : '_'.repeat(40)}) руб. 00 коп. Денежные средства в счёт оплаты стоимости транспортного средства переданы Покупателем и приняты Продавцом.
      </p>
      <p className="text-justify mb-4">
        2.2. Транспортное средство передано Продавцом и принято Покупателем при заключении Сторонами настоящего Договора. Транспортное средство пригодно для использования по его целевому назначению. Претензий по техническому состоянию, состоянию кузова и характеристикам (качеству) транспортного средства Покупатель не имеет. Отдельного документа о передаче транспортного средства Сторонами не составляется.
      </p>

      {/* 3. Guarantees */}
      <p className="font-bold mb-1">3. Гарантии и ответственность Сторон</p>
      <p className="text-justify mb-2">
        3.1. Продавец гарантирует Покупателю, что Продавец обладает всеми необходимыми правами на продажу транспортного средства, транспортное средство на момент заключения настоящего Договора никому не продано, не подарено, не заложено, в споре и под арестом (иным запрещением) не состоит, ограничения в использовании транспортного средства отсутствуют, а также, что транспортное средство не является предметом обязательств Продавца перед третьими лицами, в том числе не является предметом залога, в отношении транспортного средства не наложен запрет на совершение регистрационных действий, транспортное средство не находится под арестом, не числится в базах данных МВД России как угнанное или похищенное и не имеет иных обременений.
      </p>
      <p className="text-justify mb-2">
        3.2. В случае нарушения гарантий, указанных в пункте 3.1 настоящего Договора, или сообщения заведомо ложных сведений, указанных в пункте 1.1 настоящего Договора, Продавец обязуется незамедлительно возвратить Покупателю стоимость транспортного средства в полном объёме со дня обнаружения соответствующего нарушения.
      </p>
      <p className="text-justify mb-2">
        3.3. Покупатель обязуется в течение 10 (десяти) календарных дней со дня подписания настоящего Договора осуществить регистрацию транспортного средства в МВД России.
      </p>
      <p className="text-justify mb-2">
        3.4. В случае если в течение указанного в п. 3.3 настоящего Договора срока Покупатель не осуществил регистрацию транспортного средства, Продавец вправе направить заявление о прекращении государственного учёта транспортного средства в МВД России, в том числе посредством личного кабинета Единого портала государственных и муниципальных услуг.
      </p>
      <p className="text-justify mb-4">
        3.5. Продавец и Покупатель при заключении настоящего Договора согласились, что информация, указанная в настоящем Договоре, может быть передана в МВД России до наступления условия, предусмотренного пунктом 3.3 настоящего Договора.
      </p>

      {/* 4. Final provisions */}
      <p className="font-bold mb-1">4. Заключительные положения</p>
      <p className="text-justify mb-2">
        4.1. Настоящий Договор составлен в трёх идентичных экземплярах, имеющих равную юридическую силу: по экземпляру для каждой из Сторон, а третий — для передачи в МВД России для осуществления регистрации транспортного средства.
      </p>
      <p className="text-justify mb-2">
        4.2. Настоящий Договор вступает в силу после его подписания Сторонами.
      </p>
      <p className="text-justify mb-4">
        4.3. Покупатель и Продавец подтверждают, что не состоят под опекой и попечительством, не страдают заболеваниями, препятствующими осознать суть Договора, а также отсутствуют обстоятельства, вынуждающие совершить данный Договор на крайне невыгодных условиях.
      </p>

      {/* Signatures */}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <p className="font-bold mb-6">Продавец:</p>
          <p className="border-b border-black/30 pb-1 mb-1">
            {data.seller.fullName ? <B>{data.seller.fullName}</B> : '_'.repeat(30)}
          </p>
          <p className="text-[10px] text-center" style={{ color: '#888' }}>(ФИО)</p>
          <p className="border-b border-black/30 pb-1 mb-1 mt-4">&nbsp;</p>
          <p className="text-[10px] text-center" style={{ color: '#888' }}>(подпись)</p>
        </div>
        <div>
          <p className="font-bold mb-6">Покупатель:</p>
          <p className="border-b border-black/30 pb-1 mb-1">
            {data.buyer.fullName ? <B>{data.buyer.fullName}</B> : '_'.repeat(30)}
          </p>
          <p className="text-[10px] text-center" style={{ color: '#888' }}>(ФИО)</p>
          <p className="border-b border-black/30 pb-1 mb-1 mt-4">&nbsp;</p>
          <p className="text-[10px] text-center" style={{ color: '#888' }}>(подпись)</p>
        </div>
      </div>
    </div>
  );
}
