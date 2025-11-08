export function formatMoney(amount, currency = 'ARS', { sign = 'auto' } = {}) {
  const num = Number(amount || 0);
  
  // Use locale-specific formatting for ARS to ensure comma separators
  const locale = currency === 'ARS' ? 'es-AR' : undefined;
  
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(Math.abs(num));
  if (sign === 'none') return formatted;
  if (sign === 'always') return (num < 0 ? '-' : '+') + formatted;
  // auto: show minus if negative, otherwise no sign
  return (num < 0 ? '-' : '') + formatted;
}

export function formatMoneyNoDecimals(amount, currency = 'ARS', { sign = 'auto' } = {}) {
  const num = Number(amount || 0);
  const locale = currency === 'ARS' ? 'es-AR' : undefined;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(Math.abs(num));
  if (sign === 'none') return formatted;
  if (sign === 'always') return (num < 0 ? '-' : '+') + formatted;
  return (num < 0 ? '-' : '') + formatted;
}

export function formatNumber(value, decimals = 2) {
  const num = Number(value || 0);
  const fixed = num.toFixed(decimals);
  // Replace dot with comma for decimal separator
  return fixed.replace('.', ',');
}

export function extractYearMonth(dateStr) {
  if (!dateStr) return null;
  // Handle Date objects by converting to ISO string first
  let str = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr).trim();
  
  // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss... (with or without Z)
  // Extract year-month directly from string to avoid timezone issues
  let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  
  // DD/MM/YYYY format
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  
  // Last resort: parse as Date and use UTC (backend stores at 12:00 UTC)
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function capitalizeWords(value) {
  return String(value || '')
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ') 
    .trim();
}

const ARG_TZ = 'America/Argentina/Buenos_Aires';

export function formatDate(input) {
  if (!input) return '';
  const str = String(input).trim();
  let year, month;
  // DD/MM/YYYY
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    year = Number(m[3]);
    month = Number(m[2]);
  }
  // ISO date-only YYYY-MM-DD
  if (!year) {
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]);
    }
  }
  // ISO with time
  if (!year) {
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]);
    }
  }
  if (!year) {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
  }
  const date = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  const raw = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: ARG_TZ }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}





