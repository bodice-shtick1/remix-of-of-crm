/**
 * Builds a self-contained HTML string for Form №155 RSA (2024 edition, 837-П).
 * Matches the official PDF layout: A4, 3-column front page, back pages for A and В.
 * All styles inline — zero external dependencies.
 */
import { EuroprotocolData, EuroParticipant, CIRCUMSTANCES_LIST } from '@/types/europrotocol';

/* ── helpers ── */
function esc(v?: string): string {
  return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function val(v?: string): string {
  const t = (v || '').trim();
  return t ? `<b>${esc(t)}</b>` : '';
}

function chk(on: boolean): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border:1px solid #000;font-size:8px;font-weight:700;font-family:monospace;vertical-align:middle;background:#fff;flex-shrink:0">${on ? '✕' : '&nbsp;'}</span>`;
}

function vinBoxes(vin = ''): string {
  const chars = vin.toUpperCase().padEnd(17, ' ').slice(0, 17).split('');
  return `<span style="display:inline-flex">${chars.map(c =>
    `<span style="width:11px;height:12px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;font-family:monospace;margin-right:-1px">${esc(c.trim())}</span>`
  ).join('')}</span>`;
}

function dateBoxes(value = ''): string {
  let d = '  ', m = '  ', y = '    ';
  if (value) {
    const p = value.split('-');
    if (p.length === 3) { y = p[0]; m = p[1]; d = p[2]; }
  }
  const cell = (ch: string) =>
    `<span style="width:11px;height:12px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;font-family:monospace;margin-right:-1px">${esc((ch || '').trim())}</span>`;
  return `<span style="display:inline-flex;align-items:center">${cell(d[0])}${cell(d[1])}<span style="font-size:9px;margin:0 1px;font-weight:700">.</span>${cell(m[0])}${cell(m[1])}<span style="font-size:9px;margin:0 1px;font-weight:700">.</span>${cell(y[0])}${cell(y[1])}${cell(y[2])}${cell(y[3])}</span>`;
}

function uline(v?: string, minW = 80): string {
  return `<span style="border-bottom:1px solid #000;display:inline-block;min-width:${minW}px;vertical-align:baseline;padding:0 2px;font-size:8px">${val(v)}</span>`;
}

function fullLine(): string {
  return `<div style="border-bottom:1px solid #000;height:13px;margin:1px 0"></div>`;
}

/* ── participant side (A or В) ── */
function buildSide(label: string, p: EuroParticipant, star: string): string {
  const policy = [p.policySeries, p.policyNumber].filter(Boolean).join(' ');
  const sub = 'font-size:5.5px;color:#555;line-height:1.1';
  const row = 'margin-bottom:0;font-size:7.5px;line-height:1.2';
  const hint = 'font-size:5.5px;color:#666;margin:0 1px';
  const inl = `${row};display:flex;align-items:center;gap:1px;flex-wrap:wrap`;

  return `
<div style="flex:1;min-width:0;padding:3px 4px;display:flex;flex-direction:column">
  <div style="text-align:center;font-weight:700;font-size:8px;border-bottom:1px solid #000;padding-bottom:1px;margin-bottom:2px">Транспортное средство «${label}» ${star}</div>

  <div style="${row}"><b>4.</b> Марка, модель ТС ${uline(`${p.vehicleBrand} ${p.vehicleModel}`.trim(), 80)}</div>
  <div style="${row}">Идентификационный номер (VIN) ТС</div>
  ${vinBoxes(p.vehicleVin)}
  <div style="${row};margin-top:1px">Государственный регистрационный номер ТС</div>
  <div style="${row}">${uline(p.vehiclePlate, 80)}</div>
  <div style="${row}">Свидетельство о регистрации ТС</div>
  <div style="${inl}">
    <span style="${hint}">серия</span>${uline(p.stsNumber?.split(' ')[0], 25)}
    <span style="${hint}">номер</span>${uline(p.stsNumber?.split(' ').slice(1).join(' '), 35)}
  </div>

  <div style="${row};margin-top:1px"><b>5.</b> Собственник ТС ${uline(p.ownerFullName, 80)}</div>
  <div style="${sub}">(фамилия, имя, отчество (полное наименование юридического лица))</div>
  <div style="${row}">Адрес ${uline(p.ownerAddress, 100)}</div>

  <div style="${row};margin-top:1px"><b>6.</b> Водитель ТС ${uline(p.driverFullName || p.ownerFullName, 80)}</div>
  <div style="${sub}">(фамилия, имя, отчество)</div>
  <div style="${inl}">Дата рождения ${dateBoxes(p.driverBirthDate)}</div>
  <div style="${sub};margin-left:50px">день, месяц, год</div>
  <div style="${row}">Адрес ${uline(p.driverAddress || p.ownerAddress, 100)}</div>
  <div style="${row}">Телефон ${uline(p.ownerPhone, 80)}</div>
  <div style="${row}">Водительское удостоверение</div>
  <div style="${inl}">
    <span style="${hint}">серия</span>${uline(p.driverLicenseNumber?.split(' ')[0], 25)}
    <span style="${hint}">номер</span>${uline(p.driverLicenseNumber?.split(' ').slice(1).join(' '), 35)}
  </div>
  <div style="${inl}">Категория ${uline(p.driverLicenseCategory, 20)} <span style="margin-left:2px">${dateBoxes(p.driverLicenseExpiry)}</span></div>
  <div style="${sub};margin-left:50px">дата выдачи</div>
  <div style="${row}">Документ на право владения,</div>
  <div style="${row}">пользования, распоряжения ТС ${uline('', 50)}</div>
  <div style="${sub}">(доверенность, договор аренды, путевой лист и т.п.)</div>

  <div style="${row};margin-top:1px"><b>7.</b> Страховщик ${uline(p.insuranceCompany, 80)}</div>
  <div style="${sub}">(наименование страховщика, застраховавшего ответственность)</div>
  <div style="${row}">Страховой полис</div>
  <div style="${inl}">Номер ${uline(policy, 90)}</div>
  <div style="${inl}">Действителен до ${dateBoxes(p.policyEndDate)}</div>
  <div style="${sub};margin-left:60px">день, месяц, год</div>
  <div style="${inl}">ТС застраховано от ущерба ${chk(false)} Нет ${chk(false)} Да</div>

  <div style="${row}"><b>8.</b> Место первоначального удара</div>
  <div style="${sub}">Указать стрелкой (→)</div>
  <div style="border:1px solid #000;height:38px;margin:1px 0;background:#fff;display:flex;align-items:center;justify-content:center;padding:1px">
    <img src="/images/vehicle-impact-diagram.png" alt="Схема ТС" style="height:34px;object-fit:contain" />
  </div>

  <div style="${row};margin-top:1px"><b>9.</b> Характер и перечень видимых</div>
  <div style="${row}">повреждённых деталей и элементов</div>
  <div style="border-bottom:1px solid #000;height:10px;margin:0;font-size:6px;padding:0 2px">${esc(p.damageDescription?.substring(0, 60) || '')}</div>
  <div style="border-bottom:1px solid #000;height:10px;margin:0;font-size:6px;padding:0 2px">${esc(p.damageDescription?.substring(60, 120) || '')}</div>
  <div style="border-bottom:1px solid #000;height:10px;margin:0;font-size:6px;padding:0 2px">${esc(p.damageDescription?.substring(120) || '')}</div>

  <div style="${row};margin-top:1px"><b>10.</b> Замечания ${uline(p.remarks, 60)}</div>

  <div style="margin-top:auto;padding-top:3px;border-top:1px solid #000">
    <div style="font-size:7.5px;font-weight:700">Подпись водителя ТС «${label}»${star}</div>
    <div style="border-bottom:1px solid #000;height:12px;margin:2px 0;width:70%"></div>
    <div style="${sub}">${star} Составляется водителем транспортного средства «${label}» в отношении своего ТС.</div>
  </div>
</div>`;
}

/* ── center column: circumstances + scheme ── */
function buildCenter(a: EuroParticipant, b: EuroParticipant): string {
  const circRows = CIRCUMSTANCES_LIST.map((text, i) => {
    const num = i + 1;
    const isLast = i === CIRCUMSTANCES_LIST.length - 1;
    if (isLast) {
      return `
      <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:0;line-height:1.15">
        <span style="width:13px;flex-shrink:0;display:flex;justify-content:center;padding-top:0">${chk(a.circumstances.includes(i))}</span>
        <span style="flex:1;font-size:6px;text-align:center;padding-top:1px">Иное (для водителя ТС "А"):</span>
        <span style="width:10px;flex-shrink:0;font-weight:700;font-size:6px;text-align:center;padding-top:1px">${num}</span>
        <span style="width:13px;flex-shrink:0"></span>
      </div>
      <div style="border-bottom:1px solid #000;height:8px;margin:0 14px 0"></div>
      <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:0;line-height:1.15">
        <span style="width:13px;flex-shrink:0"></span>
        <span style="flex:1;font-size:6px;text-align:center;padding-top:1px">Иное (для водителя ТС "В"):</span>
        <span style="width:10px;flex-shrink:0;font-weight:700;font-size:6px;text-align:center;padding-top:1px">${num}</span>
        <span style="width:13px;flex-shrink:0;display:flex;justify-content:center;padding-top:0">${chk(b.circumstances.includes(i))}</span>
      </div>
      <div style="border-bottom:1px solid #000;height:8px;margin:0 14px 0"></div>`;
    }
    return `
    <div style="display:flex;align-items:flex-start;gap:0;margin-bottom:0;line-height:1.15">
      <span style="width:13px;flex-shrink:0;display:flex;justify-content:center;padding-top:0">${chk(a.circumstances.includes(i))}</span>
      <span style="width:10px;flex-shrink:0;font-weight:700;font-size:6px;text-align:center;padding-top:1px">${num}</span>
      <span style="flex:1;font-size:6px;padding-top:1px">${esc(text)}</span>
      <span style="width:10px;flex-shrink:0;font-weight:700;font-size:6px;text-align:center;padding-top:1px">${num}</span>
      <span style="width:13px;flex-shrink:0;display:flex;justify-content:center;padding-top:0">${chk(b.circumstances.includes(i))}</span>
    </div>`;
  }).join('');

  const countBox = 'width:20px;height:14px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700';

  return `
<div style="width:210px;flex-shrink:0;padding:3px 3px;display:flex;flex-direction:column;border-left:1px solid #000;border-right:1px solid #000">
  <div style="text-align:center;font-weight:700;font-size:7.5px;border-bottom:1px solid #000;padding-bottom:1px;margin-bottom:1px">
    <div style="display:flex;align-items:center;justify-content:center;gap:2px">
      <span>"А"</span>
      <span><b>11.</b> Обстоятельства ДТП</span>
      <span>"В"</span>
    </div>
    <div style="font-size:5.5px;font-weight:400;color:#555">(нужное отметить)</div>
  </div>
  ${circRows}
  <div style="font-size:6.5px;margin-top:2px;border-top:1px solid #000;padding-top:1px">
    <div style="text-align:center">Указать количество отмеченных клеток</div>
    <div style="display:flex;justify-content:space-between;margin-top:1px;padding:0 8px">
      <span style="${countBox}">${a.circumstances.length || ''}</span>
      <span style="${countBox}">${b.circumstances.length || ''}</span>
    </div>
  </div>
</div>`;
}

/* ── back page for one participant ── */
function buildBackPage(label: string, star: string, p: EuroParticipant, data: EuroprotocolData, pageStyle: string): string {
  const lineRow = `<div style="border-bottom:1px solid #000;height:16px;margin:0"></div>`;
  return `
<div style="${pageStyle};page-break-before:always;display:flex;flex-direction:column">
  <div style="flex:1;display:flex;flex-direction:column">

    <div style="margin-bottom:8px;font-size:11px;display:flex;align-items:center;gap:6px">
      <b>14.</b> Транспортное средство
      ${chk(label === 'А')} "А"
      ${chk(label === 'В')} "В"
      <span style="font-size:7px;color:#666;margin-left:4px">(нужное отметить)</span>
    </div>

    <div style="margin-bottom:2px;font-size:11px"><b>15.</b> Обстоятельства ДТП ${uline('', 300)}</div>
    <div style="font-size:7px;color:#666;margin-bottom:2px">(описать подробно)</div>
    <div style="padding:3px 4px;font-size:9px;line-height:1.8;margin-bottom:0">${esc(data.sketchDescription)}</div>
    ${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}

    <div style="margin-top:12px;margin-bottom:6px;font-size:11px"><b>16.</b> ТС находилось под управлением</div>
    <div style="margin-bottom:4px;font-size:11px;padding-left:24px;display:flex;align-items:center;gap:8px">${chk(p.driverIsOwner)} собственника ТС</div>
    <div style="margin-bottom:10px;font-size:11px;padding-left:24px;display:flex;align-items:center;gap:8px">${chk(!p.driverIsOwner)} иного лица, допущенного к управлению ТС</div>

    <div style="margin-bottom:4px;font-size:11px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <b>17.</b> Может ли ТС передвигаться своим ходом?
      ${chk(p.canMove)} Да
      ${chk(!p.canMove)} Нет
    </div>
    <div style="margin-bottom:4px;font-size:11px;padding-left:24px">Если "Нет", то где сейчас находится ТС ${uline(p.vehicleLocation || '', 240)}</div>
    ${lineRow}

    <div style="margin-top:10px;margin-bottom:4px;font-size:11px"><b>18.</b> Примечания участников ДТП, в том числе разногласия (при наличии):</div>
    ${lineRow}${lineRow}${lineRow}${lineRow}${lineRow}
    <div style="padding:3px 4px;font-size:9px;line-height:1.8">${esc(p.backRemarks)}</div>
  </div>

  <div style="margin-top:auto;padding-top:10px">
    <div style="display:flex;align-items:flex-end;font-size:11px;gap:6px">
      <span>"&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"</span>
      <span style="border-bottom:1px solid #000;width:110px"></span>
      <span>20</span>
      <span style="border-bottom:1px solid #000;width:30px"></span>
      <span>г.</span>
      <span style="border-bottom:1px solid #000;flex:1;height:16px"></span>
      <span>(</span>
      <span style="border-bottom:1px solid #000;width:130px;height:16px"></span>
      <span>)</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:7px;color:#555;margin-top:2px;padding:0 20px">
      <span>(дата заполнения)</span>
      <span>(подпись)</span>
      <span>(фамилия, инициалы)</span>
    </div>
    <div style="text-align:right;margin-top:8px;font-size:11px;display:flex;align-items:center;justify-content:flex-end;gap:4px">С приложением ${chk(data.photos.length > 0)}</div>

    ${data.photos.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px;border:1px solid #ccc;padding:4px">${data.photos.map((url, i) => `<img src="${esc(url)}" alt="Фото ${i + 1}" style="width:100%;height:60px;object-fit:cover;border:1px solid #ddd" />`).join('')}</div>` : ''}

    <div style="text-align:center;font-weight:700;font-size:8px;margin-top:12px;border-top:1px solid #000;padding-top:6px">Заполняется в двух экземплярах. Каждый участник ДТП направляет свой экземпляр настоящего извещения страховщику, застраховавшему его гражданскую ответственность¹.</div>
    <div style="font-size:5.5px;color:#666;border-top:1px solid #999;padding-top:3px;margin-top:14px">¹ Пункт 2 статьи 11¹ Федерального закона от 25 апреля 2002 года № 40-ФЗ «Об обязательном страховании гражданской ответственности владельцев транспортных средств».</div>
  </div>
</div>`;
}

/* ══════════════════════════════════════════════
   MAIN EXPORT — builds the entire Form №155
   Front page + Back page А + Back page В
   ══════════════════════════════════════════════ */
export function buildEuroprotocolHTML(data: EuroprotocolData): string {
  const pageStyle = `
    width:210mm;
    height:297mm;
    margin:0;
    padding:8mm 10mm;
    background:#fff;
    color:#000;
    font-family:Arial,Helvetica,sans-serif;
    font-size:8px;
    line-height:1.3;
    box-sizing:border-box;
    overflow:hidden;
    page-break-after:always;
  `;

  return `
<div style="${pageStyle};position:relative;overflow:hidden">

  <!-- Header: legal ref -->
  <div style="position:absolute;top:5mm;right:10mm;font-size:6.5px;color:#555;line-height:1.25;text-align:right">
    Приложение 3<br>к Положению Банка России от 1 апреля 2024 года № 837-П<br>«О правилах обязательного страхования гражданской<br>ответственности владельцев транспортных средств»
  </div>

  <!-- Title -->
  <div style="position:absolute;top:16mm;left:0;right:0;text-align:center">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase">Извещение о дорожно-транспортном происшествии</div>
    <div style="font-size:6.5px;color:#555;margin-top:1px">Составляется водителями ТС. Содержит данные об обстоятельствах ДТП, его участниках.</div>
  </div>

  <!-- 1. Место ДТП -->
  <div style="position:absolute;top:25mm;left:10mm;right:10mm;font-size:8px">
    <b>1.</b> Место ДТП ${uline(data.accidentLocation, 320)}
    <div style="text-align:center;font-size:5.5px;color:#666;margin-top:0">(республика, край, область, район, населённый пункт, улица, дом)</div>
  </div>

  <!-- 2. Дата -->
  <div style="position:absolute;top:32mm;left:10mm;right:10mm;font-size:8px;display:flex;align-items:center;gap:3px;flex-wrap:wrap">
    <b>2.</b> Дата ДТП ${dateBoxes(data.accidentDate)}
    <span style="font-size:5.5px;color:#666;margin-left:4px">день, месяц, год</span>
    <span style="margin-left:12px">часы, минуты</span>${uline(data.accidentTime, 35)}
  </div>

  <!-- 3. Свидетели -->
  <div style="position:absolute;top:37mm;left:10mm;right:10mm;font-size:8px">
    <b>3.</b> Свидетели ДТП: ${uline(data.witnesses, 300)}
    <div style="text-align:center;font-size:5.5px;color:#666;margin-top:0">(фамилия, имя, отчество, адрес места жительства)</div>
  </div>

  <!-- LEFT: ТС «А» -->
  <div style="position:absolute;top:44mm;left:10mm;width:72mm;bottom:68mm;border:1px solid #000;overflow:hidden;display:flex;flex-direction:column">
    ${buildSide('А', data.participantA, '*')}
  </div>

  <!-- CENTER: 11. Обстоятельства -->
  <div style="position:absolute;top:44mm;left:82mm;width:46mm;bottom:68mm;border-top:1px solid #000;border-bottom:1px solid #000;overflow:hidden;display:flex;flex-direction:column">
    ${buildCenter(data.participantA, data.participantB)}
  </div>

  <!-- RIGHT: ТС «В» -->
  <div style="position:absolute;top:44mm;right:10mm;width:72mm;bottom:68mm;border:1px solid #000;overflow:hidden;display:flex;flex-direction:column">
    ${buildSide('В', data.participantB, '**')}
  </div>

  <!-- 12. Схема ДТП — full width, large box -->
  <div style="position:absolute;bottom:30mm;left:10mm;right:10mm;height:36mm;border:2px solid #000;display:flex;flex-direction:column">
    <div style="font-size:9px;font-weight:700;text-align:center;padding:2px 0;border-bottom:1px solid #000"><b>12.</b> Схема ДТП</div>
    <div style="flex:1;padding:3px;position:relative">
      <div style="font-size:5px;color:#666;text-align:center;line-height:1.3;position:absolute;top:2px;left:4px;right:4px">1. План (схема) дороги – с указанием названий улиц. 2. Направление движения ТС «А» и «В». 3. Расположение ТС «А» и «В» в момент столкновения. 4. Конечное положение ТС «А» и «В». 5. Дорожные знаки, указатели, светофоры, дорожная разметка.</div>
    </div>
  </div>

  <!-- 13. Подписи -->
  <div style="position:absolute;bottom:5mm;left:10mm;right:10mm;font-size:8px">
    <div style="text-align:center;font-weight:700;margin-bottom:1px"><b>13.</b> Подписи водителей, удостоверяющие</div>
    <div style="display:flex;gap:14px;justify-content:center;margin-bottom:1px">
      <span>${chk(true)} отсутствие разногласий</span>
      <span>${chk(false)} наличие разногласий</span>
    </div>
    <div style="font-size:5.5px;color:#555;text-align:center">(указываются в п. 18 оборотной стороны Извещения)</div>
    <div style="display:flex;justify-content:space-around;font-weight:700;margin-top:2px"><div>Водитель ТС «А»</div><div>Водитель ТС «В»</div></div>
    <div style="display:flex;gap:30px;justify-content:center"><div style="border-bottom:1px solid #000;height:12px;flex:1"></div><div style="border-bottom:1px solid #000;height:12px;flex:1"></div></div>
    <div style="display:flex;gap:8px;justify-content:center;font-size:5.5px;color:#555"><span>(подпись)</span><span>(подпись)</span></div>
    <div style="font-size:5px;color:#666;text-align:center;margin-top:1px;font-style:italic">Заполняется в случае оформления ДТП без участия сотрудников ГИБДД ***. Ничего не изменять после подписания обоими водителями и разъединения бланков.</div>
  </div>
</div>

${buildBackPage('А', '*', data.participantA, data, pageStyle)}
${buildBackPage('В', '**', data.participantB, data, pageStyle)}`;
}
