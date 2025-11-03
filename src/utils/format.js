export function formatMoney(amount, currency = 'USD', { sign = 'auto' } = {}) {
  const num = Number(amount || 0);
  const formatter = new Intl.NumberFormat(undefined, {
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





