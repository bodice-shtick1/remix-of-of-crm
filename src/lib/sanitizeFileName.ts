const TRANSLIT_MAP: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

/**
 * Transliterates a string from Cyrillic to Latin and removes unsafe characters.
 * Result contains only [a-z0-9_-] and dots for extension.
 */
export function sanitizeFileName(raw: string): string {
  // Separate extension
  const dotIdx = raw.lastIndexOf('.');
  const ext = dotIdx > 0 ? raw.slice(dotIdx) : '';
  const name = dotIdx > 0 ? raw.slice(0, dotIdx) : raw;

  const transliterated = name
    .toLowerCase()
    .split('')
    .map(ch => TRANSLIT_MAP[ch] ?? ch)
    .join('');

  // Replace spaces and non-alphanumeric with underscore, collapse multiples
  const cleaned = transliterated
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return (cleaned || 'file') + ext.toLowerCase();
}
