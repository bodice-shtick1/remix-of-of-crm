/**
 * Convert a number to Russian words (рубли).
 * Example: 150000 → "Сто пятьдесят тысяч рублей 00 копеек"
 */

const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

function pluralize(n: number, one: string, two: string, five: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return five;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

function threeDigits(n: number, feminine: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  const parts: string[] = [];
  if (h > 0) parts.push(hundreds[h]);
  if (t === 1) {
    parts.push(teens[o]);
  } else {
    if (t > 1) parts.push(tens[t]);
    if (o > 0) parts.push(feminine ? onesF[o] : ones[o]);
  }
  return parts.join(' ');
}

export function numberToWordsRub(amount: number): string {
  if (amount === 0) return 'Ноль рублей 00 копеек';
  
  const rub = Math.floor(Math.abs(amount));
  const kop = Math.round((Math.abs(amount) - rub) * 100);
  
  const parts: string[] = [];
  
  // Миллионы
  const millions = Math.floor(rub / 1_000_000);
  if (millions > 0) {
    parts.push(threeDigits(millions, false));
    parts.push(pluralize(millions, 'миллион', 'миллиона', 'миллионов'));
  }
  
  // Тысячи
  const thousands = Math.floor((rub % 1_000_000) / 1_000);
  if (thousands > 0) {
    parts.push(threeDigits(thousands, true));
    parts.push(pluralize(thousands, 'тысяча', 'тысячи', 'тысяч'));
  }
  
  // Единицы
  const remainder = rub % 1000;
  if (remainder > 0 || parts.length === 0) {
    parts.push(threeDigits(remainder, false));
  }
  
  const rubWord = pluralize(rub, 'рубль', 'рубля', 'рублей');
  const kopStr = kop.toString().padStart(2, '0');
  const kopWord = pluralize(kop, 'копейка', 'копейки', 'копеек');
  
  let result = parts.filter(Boolean).join(' ') + ' ' + rubWord + ' ' + kopStr + ' ' + kopWord;
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}
