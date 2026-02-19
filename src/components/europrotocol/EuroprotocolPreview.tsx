import { EuroprotocolData, EuroParticipant, CIRCUMSTANCES_LIST } from '@/types/europrotocol';

/* ── tiny helpers ── */
const f = (v?: string) => v?.trim() || '';

function U({ v, w = 20 }: { v?: string; w?: number }) {
  const t = f(v);
  return t
    ? <b className="ep-val">{t}</b>
    : <span className="ep-blank" style={{ minWidth: w }}></span>;
}

function Chk({ on }: { on: boolean }) {
  return <span className="ep-chk">{on ? '✕' : '\u00A0'}</span>;
}

function VinBoxes({ vin = '' }: { vin?: string }) {
  const chars = vin.toUpperCase().padEnd(17, ' ').slice(0, 17).split('');
  return (
    <span className="ep-vin">
      {chars.map((c, i) => <span key={i} className="ep-vin-cell">{c.trim()}</span>)}
    </span>
  );
}

function DateBoxes({ val: value = '' }: { val?: string }) {
  let d = '  ', m = '  ', y = '    ';
  if (value) {
    const p = value.split('-');
    if (p.length === 3) { y = p[0]; m = p[1]; d = p[2]; }
  }
  const cell = (ch: string) => <span className="ep-date-cell">{ch?.trim() || ''}</span>;
  return (
    <span className="ep-date-row">
      {cell(d[0])}{cell(d[1])}<span className="ep-dot">.</span>
      {cell(m[0])}{cell(m[1])}<span className="ep-dot">.</span>
      {cell(y[0])}{cell(y[1])}{cell(y[2])}{cell(y[3])}
    </span>
  );
}

/* ── participant side (A or B) ── */
function Side({ label, p, star }: { label: string; p: EuroParticipant; star: string }) {
  const policy = [p.policySeries, p.policyNumber].filter(Boolean).join(' ');
  return (
    <div className="ep-side">
      <div className="ep-side-title">Транспортное средство «{label}» {star}</div>
      <div className="ep-row"><b>4.</b> Марка, модель ТС <span className="ep-line"><U v={`${p.vehicleBrand} ${p.vehicleModel}`.trim()} /></span></div>
      <div className="ep-row">Идентификационный номер (VIN) ТС</div>
      <VinBoxes vin={p.vehicleVin} />
      <div className="ep-row mt-1">Государственный регистрационный знак ТС</div>
      <div className="ep-row">
        <span className="ep-line"><U v={p.vehiclePlate} /></span>
      </div>
      <div className="ep-row">Свидетельство о регистрации ТС</div>
      <div className="ep-row ep-row-inline">
        <span className="ep-hint">серия</span><span className="ep-line ep-short"><U v={p.stsNumber?.split(' ')[0]} w={30} /></span>
        <span className="ep-hint">номер</span><span className="ep-line ep-short"><U v={p.stsNumber?.split(' ').slice(1).join(' ')} w={40} /></span>
      </div>

      <div className="ep-row"><b>5.</b> Собственник ТС <span className="ep-line"><U v={p.ownerFullName} /></span></div>
      <div className="ep-sub">(фамилия,</div>
      <div className="ep-sub">имя, отчество (полное наименование юридического лица))</div>
      <div className="ep-row">Адрес <span className="ep-line"><U v={p.ownerAddress} /></span></div>

      <div className="ep-row"><b>6.</b> Водитель ТС <span className="ep-line"><U v={p.driverFullName || p.ownerFullName} /></span></div>
      <div className="ep-sub">(фамилия, имя, отчество)</div>
      <div className="ep-row ep-row-inline">Дата рождения <DateBoxes val={p.driverBirthDate} /></div>
      <div className="ep-sub" style={{ marginLeft: 60 }}>день, месяц, год</div>
      <div className="ep-row">Адрес <span className="ep-line"><U v={p.driverAddress || p.ownerAddress} /></span></div>
      <div className="ep-row">Телефон <span className="ep-line"><U v={p.ownerPhone} /></span></div>
      <div className="ep-row">Водительское удостоверение</div>
      <div className="ep-row ep-row-inline">
        <span className="ep-hint">серия</span><span className="ep-line ep-short"><U v={p.driverLicenseNumber?.split(' ')[0]} w={30} /></span>
        <span className="ep-hint">номер</span><span className="ep-line ep-short"><U v={p.driverLicenseNumber?.split(' ').slice(1).join(' ')} w={40} /></span>
      </div>
      <div className="ep-row ep-row-inline">
        Категория <span className="ep-line ep-short"><U v={p.driverLicenseCategory} w={25} /></span>
        <span style={{ marginLeft: 4 }}><DateBoxes val={p.driverLicenseExpiry} /></span>
      </div>
      <div className="ep-sub" style={{ marginLeft: 60 }}>дата выдачи</div>
      <div className="ep-row">Документ на право владения, пользования,</div>
      <div className="ep-row">распоряжения ТС <span className="ep-line"><U v="" /></span></div>
      <div className="ep-sub">(доверенность, договор аренды, путевой лист и т.п.)</div>

      <div className="ep-row"><b>7.</b> Страховщик <span className="ep-line"><U v={p.insuranceCompany} /></span></div>
      <div className="ep-sub">(наименование страховщика, застраховавшего ответственность)</div>
      <div className="ep-row">Страховой полис</div>
      <div className="ep-row"><span className="ep-line"><U v={policy} /></span></div>
      <div className="ep-sub" style={{ textAlign: 'right' }}>номер</div>
      <div className="ep-row ep-row-inline">Действителен до <DateBoxes val={p.policyEndDate} /></div>
      <div className="ep-sub" style={{ marginLeft: 80 }}>день, месяц, год</div>
      <div className="ep-row ep-row-inline">
        ТС застраховано от ущерба <Chk on={false} /> Нет <Chk on={false} /> Да
      </div>

      <div className="ep-row"><b>8.</b> Место первоначального удара</div>
      <div className="ep-sub">Указать стрелкой (→)</div>
      <div className="ep-impact-box"></div>

      <div className="ep-separator" />

      <div className="ep-row"><b>9.</b> Характер и перечень видимых</div>
      <div className="ep-row">повреждённых деталей и элементов</div>
      <div className="ep-damage-box">{p.damageDescription || ''}</div>

      <div className="ep-separator" />

      <div className="ep-row"><b>10.</b> Замечания <span className="ep-line"><U v={p.remarks} /></span></div>

      <div className="ep-separator" />

      <div className="ep-sign-block">
        <div><b>Подпись водителя ТС «{label}»{star}</b></div>
        <div className="ep-sign-line"></div>
        <div className="ep-sub">
          {star} Составляется водителем транспортного<br />
          средства ТС «{label}» в отношении своего ТС.
        </div>
      </div>
    </div>
  );
}

/* ── center: circumstances + scheme ── */
function Center({ a, b }: { a: EuroParticipant; b: EuroParticipant }) {
  return (
    <div className="ep-center">
      <div className="ep-center-title"><b>11.</b> Обстоятельства ДТП (нужное отметить)</div>
      <div className="ep-circ-header">
        <span className="ep-circ-col-hdr">«А»</span>
        <span className="ep-circ-spacer"></span>
        <span className="ep-circ-col-hdr">«Б»</span>
      </div>
      {CIRCUMSTANCES_LIST.map((text, i) => (
        <div key={i} className="ep-circ-row">
          <span className="ep-circ-chk"><Chk on={a.circumstances.includes(i)} /></span>
          <span className="ep-circ-num">{i + 1}</span>
          <span className="ep-circ-text">{text}</span>
          <span className="ep-circ-num">{i + 1}</span>
          <span className="ep-circ-chk"><Chk on={b.circumstances.includes(i)} /></span>
        </div>
      ))}

      <div className="ep-circ-other">Иное (для водителя ТС «А»):</div>
      <div className="ep-line-full"></div>
      <div className="ep-circ-other">Иное (для водителя ТС «Б»):</div>
      <div className="ep-line-full"></div>

      <div className="ep-circ-count">
        <div>Указать количество отмеченных клеток</div>
        <div className="ep-circ-count-boxes">
          <span className="ep-count-box">{a.circumstances.length || ''}</span>
          <span className="ep-count-box">{b.circumstances.length || ''}</span>
        </div>
      </div>

      <div className="ep-scheme-title"><b>12.</b> <span style={{ marginLeft: 60 }}>Схема ДТП</span></div>
      <div className="ep-scheme-box">
        <div className="ep-scheme-hint">
          1. План (схема) дороги – с указанием названий улиц. 2. Направление движения ТС «А» и «Б».
          3. Расположение ТС «А» и «Б» в момент столкновения. 4. Конечное положение ТС «А» и «Б».
          5. Дорожные знаки, указатели, светофоры, дорожная разметка.
        </div>
      </div>
    </div>
  );
}

/* ══════ MAIN ══════ */
const FORM_W = 780;

export function EuroprotocolPreview({ data }: { data: EuroprotocolData }) {
  return (
    <div className="ep-wrapper">
      <div className="ep-form" id="euro-print-area">
        {/* legal ref */}
        <div className="ep-legal">
          Приложение 5<br />
          к Положению Банка России от 19 сентября 2014 года № 431-П<br />
          «О правилах обязательного страхования гражданской<br />
          ответственности владельцев транспортных средств»<br />
          (в ред. Указаний Банка России от 08.10.2019 № 5283-У,<br />
          от 15.07.2021 № 5859-У)
        </div>
        <div className="ep-form-label">(форма)</div>

        <h1 className="ep-title">Извещение о дорожно-транспортном происшествии</h1>
        <p className="ep-subtitle">Составляется водителями ТС. Содержит данные об обстоятельствах ДТП, его участниках.</p>

        {/* 1 */}
        <div className="ep-field"><b>1.</b> Место ДТП <span className="ep-line"><U v={data.accidentLocation} w={300} /></span></div>
        <div className="ep-sub-center">(республика, край, область, район, населённый пункт, улица, дом)</div>

        {/* 2 */}
        <div className="ep-field ep-row-inline">
          <b>2.</b> Дата ДТП <DateBoxes val={data.accidentDate} />
          <span className="ep-hint" style={{ marginLeft: 8 }}>день, месяц, год</span>
          <span style={{ marginLeft: 16 }}>часы, минуты</span>
          <span className="ep-line" style={{ marginLeft: 4 }}><U v={data.accidentTime} w={40} /></span>
        </div>

        {/* 3 */}
        <div className="ep-field"><b>3.</b> Свидетели ДТП: <span className="ep-line"><U v={data.witnesses} w={280} /></span></div>
        <div className="ep-sub-center">(фамилия, имя, отчество (здесь и далее отчество указывается при наличии), адрес места жительства)</div>

        {/* ═══ THREE-COLUMN ═══ */}
        <div className="ep-three-col">
          <div className="ep-col-left"><Side label="А" p={data.participantA} star="*" /></div>
          <div className="ep-col-center"><Center a={data.participantA} b={data.participantB} /></div>
          <div className="ep-col-right"><Side label="Б" p={data.participantB} star="**" /></div>
        </div>

        {/* 13 */}
        <div className="ep-signatures">
          <div className="ep-sig-title"><b>13.</b> Подписи водителей, удостоверяющие</div>
          <div className="ep-sig-options">
            <span><Chk on={true} /> отсутствие разногласий</span>
            <span><Chk on={false} /> наличие разногласий</span>
          </div>
          <div className="ep-sub">(указываются в п. 18 оборотной стороны Извещения)</div>
          <div className="ep-sig-pair">
            <div className="ep-sig-one">
              <div>Водитель ТС «А»</div>
              <div>Водитель ТС «Б»</div>
            </div>
            <div className="ep-sig-lines">
              <div className="ep-sign-line"></div>
              <div className="ep-sign-line"></div>
            </div>
            <div className="ep-sub-row">
              <span>(подпись)</span><span>(подпись)</span>
            </div>
          </div>
          <div className="ep-sig-footer">
            Заполняется в случае оформления ДТП без участия сотрудников<br />
            ГИБДД ***. Ничего не изменять после подписания обоими<br />
            водителями и расцепления бланков.
          </div>
        </div>

        {/* ═══ PAGE 2 ═══ */}
        <div className="ep-page2">
          <div className="ep-page2-note">— Оборотная сторона —</div>

          <div className="ep-field ep-row-inline">
            <b>14.</b> Транспортное средство
            <Chk on={true} /> «А» <Chk on={false} /> «Б»
            <span className="ep-hint" style={{ marginLeft: 6 }}>(нужное отметить)</span>
          </div>

          <div className="ep-field"><b>15.</b> Обстоятельства ДТП <span className="ep-line"></span></div>
          <div className="ep-text-box ep-big-box">{data.sketchDescription || ''}</div>

          <div className="ep-field ep-row-inline">
            <b>16.</b> ТС находилось под управлением
          </div>
          <div className="ep-field ep-row-inline" style={{ paddingLeft: 20 }}>
            <Chk on={true} /> собственника ТС
          </div>
          <div className="ep-field ep-row-inline" style={{ paddingLeft: 20 }}>
            <Chk on={false} /> иного лица, допущенного к управлению ТС
          </div>

          <div className="ep-field ep-row-inline">
            <b>17.</b> Может ли ТС передвигаться своим ходом?
            <Chk on={true} /> Да <Chk on={false} /> Нет
          </div>
          <div className="ep-field" style={{ paddingLeft: 20 }}>
            Если «Нет», то где сейчас находится ТС <span className="ep-line"><U v="" w={120} /></span>
          </div>

          <div className="ep-field"><b>18.</b> Примечания участников ДТП, в том числе разногласия (при наличии):</div>
          <div className="ep-line-full"></div>
          <div className="ep-line-full"></div>
          <div className="ep-line-full"></div>

          {/* date + signature */}
          <div className="ep-bottom-sig">
            <span>« ___ » ________________ 20___ г.</span>
            <span className="ep-line" style={{ flex: 1, marginLeft: 20, marginRight: 20 }}></span>
            <span>( <span className="ep-line" style={{ width: 100 }}></span> )</span>
          </div>
          <div className="ep-sub-row" style={{ justifyContent: 'space-between' }}>
            <span>(дата заполнения)</span>
            <span>(подпись)</span>
            <span>(фамилия, инициалы)</span>
          </div>
          <div style={{ textAlign: 'right', marginTop: 4 }}>С приложением <Chk on={data.photos.length > 0} /></div>

          {data.photos.length > 0 && (
            <div className="ep-photos">
              {data.photos.map((url, i) => (
                <img key={i} src={url} alt={`Фото ${i + 1}`} className="ep-photo" />
              ))}
            </div>
          )}

          <div className="ep-final-note">
            Заполняется в двух экземплярах. Каждый участник ДТП направляет свой экземпляр<br />
            настоящего извещения страховщику, застраховавшему его гражданскую ответственность.
          </div>
        </div>
      </div>
    </div>
  );
}
