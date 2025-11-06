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





