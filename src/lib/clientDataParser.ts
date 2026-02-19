/**
 * Smart parser for client personal data from pasted text.
 * Extracts: FIO, phone, birth date, email, address, passport data.
 */

export interface ParsedClientData {
  lastName: string;
  firstName: string;
  middleName: string;
  phone: string;
  birthDate: string; // YYYY-MM-DD format for <input type="date">
  email: string;
  address: string;
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string; // YYYY-MM-DD
  passportIssuedBy: string;
  passportUnitCode: string;
}

/** Capitalize first letter, lowercase the rest */
function capitalizeWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Format phone to +7 (XXX) XXX-XX-XX */
function formatPhone(digits: string): string {
  let d = digits.replace(/\D/g, '');
  if (d.startsWith('8') && d.length === 11) d = '7' + d.slice(1);
  if (d.startsWith('7') && d.length === 11) d = d.slice(1);
  if (d.length === 10) {
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  }
  return '';
}

/** Extract phone number from text */
function extractPhone(text: string): { phone: string; cleaned: string } {
  const phoneRegex = /(?:\+?[78][\s\-]?)?(?:\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/g;
  const match = text.match(phoneRegex);
  if (match) {
    const raw = match[0];
    const formatted = formatPhone(raw);
    if (formatted) {
      return { phone: formatted, cleaned: text.replace(raw, ' ').trim() };
    }
  }

  const digitsOnly = /(?<!\d)([78]?\d{10})(?!\d)/;
  const dm = text.match(digitsOnly);
  if (dm) {
    const formatted = formatPhone(dm[0]);
    if (formatted) {
      return { phone: formatted, cleaned: text.replace(dm[0], ' ').trim() };
    }
  }

  return { phone: '', cleaned: text };
}

/** Extract email from text */
function extractEmail(text: string): { email: string; cleaned: string } {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  if (match) {
    return { email: match[0].toLowerCase(), cleaned: text.replace(match[0], ' ').trim() };
  }
  return { email: '', cleaned: text };
}

/** Extract passport data from text */
function extractPassport(text: string): {
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssuedBy: string;
  passportUnitCode: string;
  cleaned: string;
} {
  let cleaned = text;
  let passportSeries = '';
  let passportNumber = '';
  let passportIssueDate = '';
  let passportIssuedBy = '';
  let passportUnitCode = '';

  // Unit code: 000-000
  const unitCodeRegex = /(\d{3})-(\d{3})/;
  const unitMatch = cleaned.match(unitCodeRegex);
  if (unitMatch) {
    passportUnitCode = unitMatch[0];
    cleaned = cleaned.replace(unitMatch[0], ' ').trim();
  }

  // Series + number: "4510 123456" or "4510123456" (4 digits + 6 digits)
  const seriesNumberRegex = /(?:(?:паспорт|серия|с\/н)[:\s]*)?(\d{4})\s*(\d{6})(?!\d)/i;
  const snMatch = cleaned.match(seriesNumberRegex);
  if (snMatch) {
    passportSeries = snMatch[1];
    passportNumber = snMatch[2];
    cleaned = cleaned.replace(snMatch[0], ' ').trim();
  }

  // "выдан" / "кем выдан" block — extract issued_by and issue_date
  const issuedByRegex = /(?:кем\s+выдан|выдан[а-я]*)[:\s]+(.+)/i;
  const issuedMatch = cleaned.match(issuedByRegex);
  if (issuedMatch) {
    let issuedBlock = issuedMatch[1].trim();

    // Try to find a date inside the issued block
    const dateInBlock = /(\d{2})[.\-/](\d{2})[.\-/](\d{4})/;
    const dateMatch = issuedBlock.match(dateInBlock);
    if (dateMatch) {
      const [dateFull, day, month, year] = dateMatch;
      const yearNum = parseInt(year);
      if (yearNum >= 1920 && yearNum <= 2026 && parseInt(month) <= 12 && parseInt(day) <= 31) {
        passportIssueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        issuedBlock = issuedBlock.replace(dateFull, '').trim();
      }
    }

    // Clean up the issued_by text
    passportIssuedBy = issuedBlock
      .replace(/^[,;\s.]+|[,;\s.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    cleaned = cleaned.replace(issuedMatch[0], ' ').trim();
  }

  // If no issue date found yet, look for date near "дата выдачи"
  if (!passportIssueDate) {
    const issueDateRegex = /(?:дата\s+выдачи)[:\s]*(\d{2})[.\-/](\d{2})[.\-/](\d{4})/i;
    const idMatch = cleaned.match(issueDateRegex);
    if (idMatch) {
      const [full, day, month, year] = idMatch;
      const yearNum = parseInt(year);
      if (yearNum >= 1920 && yearNum <= 2026 && parseInt(month) <= 12 && parseInt(day) <= 31) {
        passportIssueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        cleaned = cleaned.replace(full, ' ').trim();
      }
    }
  }

  return { passportSeries, passportNumber, passportIssueDate, passportIssuedBy, passportUnitCode, cleaned };
}

/** Extract FIO (Full Name) from text — run BEFORE address extraction */
function extractFIO(text: string): { lastName: string; firstName: string; middleName: string; cleaned: string } {
  const cleaned = text.replace(/\s+/g, ' ').trim();

  const fioRegex = /([А-ЯЁа-яё]{2,})\s+([А-ЯЁа-яё]{2,})(?:\s+([А-ЯЁа-яё]{2,}))?/;
  const match = cleaned.match(fioRegex);

  if (match) {
    const [fullMatch, w1, w2, w3] = match;

    const isPatronymic = (w: string) => /(?:вич|вна|ьич|ична|ович|овна|евич|евна|ич)$/i.test(w);
    const isAddressWord = (w: string) => /^(?:ул|улица|пр|просп|проспект|пер|переулок|бульвар|наб|набережная|шоссе|площадь|город|область|район|дом|квартира|корпус|строение|микрорайон|село|поселок|индекс|прописан|прописка|адрес|регистрация|выдан|паспорт)\.?$/i.test(w);

    if (isAddressWord(w1) || isAddressWord(w2)) {
      return { lastName: '', firstName: '', middleName: '', cleaned: text };
    }

    let lastName = '', firstName = '', middleName = '';

    if (w3) {
      if (isPatronymic(w3)) {
        lastName = capitalizeWord(w1);
        firstName = capitalizeWord(w2);
        middleName = capitalizeWord(w3);
      } else if (isPatronymic(w2)) {
        lastName = capitalizeWord(w3);
        firstName = capitalizeWord(w1);
        middleName = capitalizeWord(w2);
      } else {
        lastName = capitalizeWord(w1);
        firstName = capitalizeWord(w2);
        middleName = capitalizeWord(w3);
      }
    } else {
      lastName = capitalizeWord(w1);
      firstName = capitalizeWord(w2);
    }

    const remainingText = cleaned.replace(fullMatch, ' ').replace(/\s+/g, ' ').trim();
    return { lastName, firstName, middleName, cleaned: remainingText };
  }

  return { lastName: '', firstName: '', middleName: '', cleaned: text };
}

/** Extract birth date from text */
function extractBirthDate(text: string): { birthDate: string; cleaned: string } {
  const fullDateRegex = /(\d{2})[.\-/](\d{2})[.\-/](\d{4})/;
  let match = text.match(fullDateRegex);
  if (match) {
    const [full, day, month, year] = match;
    const yearNum = parseInt(year);
    if (yearNum >= 1920 && yearNum <= 2026 && parseInt(month) <= 12 && parseInt(day) <= 31) {
      return {
        birthDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        cleaned: text.replace(full, ' ').trim(),
      };
    }
  }

  const shortDateRegex = /(\d{2})[.\-/\s](\d{2})[.\-/\s](\d{2})(?!\d)/;
  match = text.match(shortDateRegex);
  if (match) {
    const [full, day, month, shortYear] = match;
    const yearNum = parseInt(shortYear);
    const fullYear = yearNum > 26 ? 1900 + yearNum : 2000 + yearNum;
    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
      return {
        birthDate: `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        cleaned: text.replace(full, ' ').trim(),
      };
    }
  }

  const compactRegex = /(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/;
  const compactMatch = text.match(compactRegex);
  if (compactMatch) {
    const [full, day, month, year] = compactMatch;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    if (yearNum >= 1920 && yearNum <= 2026 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return {
        birthDate: `${year}-${month}-${day}`,
        cleaned: text.replace(full, ' ').trim(),
      };
    }
  }

  return { birthDate: '', cleaned: text };
}

/** Extract address from text — run AFTER FIO is already removed */
function extractAddress(text: string): { address: string; cleaned: string } {
  const prefixRegex = /(?:прописан[а-я]*|адрес(?:\s+регистрации)?|регистрация|место жительства)[:\s]+(.+)/i;
  const prefixMatch = text.match(prefixRegex);
  if (prefixMatch) {
    const addr = prefixMatch[1].trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
    if (addr.length > 3) {
      return { address: cleanFieldValue(addr), cleaned: text.replace(prefixMatch[0], ' ').trim() };
    }
  }

  const addressKeywords = /(?:ул\.|улица|пр\.|просп\.|проспект|пер\.|переулок|бульвар|б-р|наб\.|набережная|шоссе|ш\.|площадь|пл\.|г\.|город|обл\.|область|р-н|район|д\.|дом|кв\.|квартира|корп\.|корпус|стр\.|строение|мкр\.|микрорайон|с\.|село|пос\.|поселок)/i;

  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (addressKeywords.test(line)) {
      const remaining = lines.filter((_, idx) => idx !== i).join('\n');
      return { address: cleanFieldValue(line), cleaned: remaining.trim() };
    }
  }

  const postalMatch = text.match(/(\d{6}[,\s]+[^\n]{10,})/);
  if (postalMatch) {
    return { address: cleanFieldValue(postalMatch[1].trim()), cleaned: text.replace(postalMatch[1], ' ').trim() };
  }

  return { address: '', cleaned: text };
}

/** Remove junk prefixes/suffixes from field values */
function cleanFieldValue(value: string): string {
  return value
    .replace(/^(?:г\.|тел\.|др\.|т\.)[:\s]*/gi, '')
    .replace(/[,;\s]+$/g, '')
    .trim();
}

/**
 * Main parser function. Extracts client data from raw pasted text.
 * Order: phone -> email -> passport -> FIO -> date -> address
 */
export function parseClientData(rawText: string): ParsedClientData {
  if (!rawText || !rawText.trim()) {
    return {
      lastName: '', firstName: '', middleName: '',
      phone: '', birthDate: '', email: '', address: '',
      passportSeries: '', passportNumber: '', passportIssueDate: '',
      passportIssuedBy: '', passportUnitCode: '',
    };
  }

  let text = rawText.trim();

  const { phone, cleaned: afterPhone } = extractPhone(text);
  const { email, cleaned: afterEmail } = extractEmail(afterPhone);
  // Passport BEFORE FIO to avoid "выдан ОВД..." being parsed as name
  const { passportSeries, passportNumber, passportIssueDate, passportIssuedBy, passportUnitCode, cleaned: afterPassport } = extractPassport(afterEmail);
  const { lastName, firstName, middleName, cleaned: afterFIO } = extractFIO(afterPassport);
  const { birthDate, cleaned: afterDate } = extractBirthDate(afterFIO);
  const { address } = extractAddress(afterDate);

  return {
    lastName, firstName, middleName, phone, birthDate, email, address,
    passportSeries, passportNumber, passportIssueDate, passportIssuedBy, passportUnitCode,
  };
}
