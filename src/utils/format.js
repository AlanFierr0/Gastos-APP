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
  // DD/MM/YYYY
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0));
    return d.toLocaleDateString('es-AR', { timeZone: ARG_TZ });
  }
  // ISO date-only YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, yyyy, mm, dd] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0));
    return d.toLocaleDateString('es-AR', { timeZone: ARG_TZ });
  }
  // ISO with time: take calendar date part
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) {
    const [_, yyyy, mm, dd] = m;
    const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0, 0));
    return d.toLocaleDateString('es-AR', { timeZone: ARG_TZ });
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { timeZone: ARG_TZ });
}





