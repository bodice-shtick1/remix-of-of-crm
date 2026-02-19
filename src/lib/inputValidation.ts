import { toast } from 'sonner';

// Debounce toast to avoid spam
let lastToastTime = 0;
const TOAST_DEBOUNCE_MS = 1500;

function showValidationToast(message: string) {
  const now = Date.now();
  if (now - lastToastTime < TOAST_DEBOUNCE_MS) return;
  lastToastTime = now;
  toast.warning(message, { duration: 2500 });
}

/** Trigger shake animation on an element */
export function triggerShake(element: HTMLElement | null) {
  if (!element) return;
  element.classList.remove('animate-shake');
  // Force reflow to restart animation
  void element.offsetWidth;
  element.classList.add('animate-shake');
  setTimeout(() => element.classList.remove('animate-shake'), 400);
}

/** Validate plate number character and show toast if invalid */
export function validatePlateChar(key: string, element: HTMLElement | null): boolean {
  if (key.length !== 1) return true; // allow special keys
  if (/\d/.test(key)) return true;

  const VALID_CYRILLIC = 'АВЕКМНОРСТУХ';
  const VALID_LATIN = 'ABEKMHOPCTYX';
  const upper = key.toUpperCase();

  if (VALID_CYRILLIC.includes(upper) || VALID_LATIN.includes(upper)) return true;

  triggerShake(element);
  showValidationToast('В госномерах используются только: А, В, Е, К, М, Н, О, Р, С, Т, У, Х');
  return false;
}

/** Validate VIN character and show toast if invalid */
export function validateVinChar(key: string, element: HTMLElement | null): boolean {
  if (key.length !== 1) return true;
  const upper = key.toUpperCase();

  if (/[A-HJ-NPR-Z0-9]/.test(upper)) return true;

  triggerShake(element);
  if (/[IOQ]/i.test(key)) {
    showValidationToast('Символы I, O, Q не используются в VIN-кодах');
  } else {
    showValidationToast('VIN может содержать только латинские буквы (кроме I, O, Q) и цифры');
  }
  return false;
}

/** Validate series character (letters only by mask 'A') */
export function validateSeriesChar(key: string, mask: string, currentLength: number, element: HTMLElement | null): boolean {
  if (key.length !== 1) return true;
  if (currentLength >= mask.length) return false;

  const maskChar = mask[currentLength];
  const upper = key.toUpperCase();

  if (maskChar === 'A') {
    if (/[A-ZА-ЯЁ]/i.test(upper)) return true;
    triggerShake(element);
    showValidationToast('В серии полиса разрешены только буквы');
    return false;
  }
  if (maskChar === '0') {
    if (/\d/.test(key)) return true;
    triggerShake(element);
    showValidationToast('В этом поле разрешены только цифры');
    return false;
  }
  return true; // '*' allows anything
}

/** Validate number character (digits only by mask '0') */
export function validateNumberChar(key: string, mask: string, currentLength: number, element: HTMLElement | null): boolean {
  if (key.length !== 1) return true;
  if (currentLength >= mask.length) return false;

  const maskChar = mask[currentLength];

  if (maskChar === '0') {
    if (/\d/.test(key)) return true;
    triggerShake(element);
    showValidationToast('В этом поле разрешены только цифры');
    return false;
  }
  if (maskChar === 'A') {
    if (/[A-ZА-ЯЁ]/i.test(key)) return true;
    triggerShake(element);
    showValidationToast('В этом поле разрешены только буквы');
    return false;
  }
  return true;
}
