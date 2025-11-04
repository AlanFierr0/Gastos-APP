import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';
import { useNavigate } from 'react-router-dom';
import { PieBreakdown, BarCompare } from '../components/Chart.jsx';

export default function Dashboard() {
  const { expenses, income, t, locale } = useApp();
  const [periodType, setPeriodType] = useState('month'); // 'month' | 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentYearMonth());
  const navigate = useNavigate();
  
  // Calculate current month on each render to ensure it's always fresh
  const currentMonth = getCurrentYearMonth();

  // (moved below, after periodOptions declaration)

  // Determine selected year for month mode
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || currentMonth).split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod, currentMonth]);

  // Build 12 months for the selected year (always available)
  const months = useMemo(() => buildFullYearMonths(selectedYear, locale), [selectedYear, locale]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;

  // Ensure a valid month only when switching to month mode or when options update
  React.useEffect(() => {
    if (periodType !== 'month') return;
    const isValid = Array.isArray(periodOptions) && periodOptions.some((p) => p.value === selectedPeriod);
    if (!isValid) setSelectedPeriod(currentMonth);
  }, [periodType, periodOptions, selectedPeriod, currentMonth]);

  // Always use current month if selectedPeriod is not in options (for initial load)
  const effectivePeriod = useMemo(() => {
    let result;
    if (periodOptions.length) {
      const isInOptions = periodOptions.some((p) => p.value === selectedPeriod);
      result = isInOptions ? selectedPeriod : (periodType === 'month' ? currentMonth : periodOptions[0].value);
    } else {
      result = periodType === 'month' ? currentMonth : String(new Date().getFullYear());
    }
    console.log('effectivePeriod calculation:', { 
      periodOptionsLength: periodOptions.length, 
      selectedPeriod, 
      currentMonth, 
      periodType, 
      result,
      firstOption: periodOptions[0]?.value 
    });
    return result;
  }, [periodOptions, selectedPeriod, currentMonth, periodType]);

  const { periodExpenses, periodIncome } = useMemo(() => {
    return periodType === 'month'
      ? filterByMonth(expenses, income, effectivePeriod)
      : filterByYear(expenses, income, Number(effectivePeriod));
  }, [expenses, income, periodType, effectivePeriod]);

  const monthTotals = useMemo(() => computeTotals(periodExpenses, periodIncome), [periodExpenses, periodIncome]);

  const previousPeriodTotals = useMemo(() => {
    let prevPeriod = null;
    if (periodType === 'month') {
      const [y, m] = effectivePeriod.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y, m - 2, 1));
      prevPeriod = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      prevPeriod = String(Number(effectivePeriod) - 1);
    }
    if (!prevPeriod) return null;
    const prev = periodType === 'month'
      ? filterByMonth(expenses, income, prevPeriod)
      : filterByYear(expenses, income, Number(prevPeriod));
    return computeTotals(prev.periodExpenses, prev.periodIncome);
  }, [periodType, effectivePeriod, expenses, income]);

  const trends = useMemo(() => {
    if (!previousPeriodTotals) {
      return {
        income: null,
        expenses: null,
        balance: monthTotals.balance >= 0 ? { positive: true, label: 'Positive' } : { positive: false, label: 'Negative' },
      };
    }
    const calcChange = (curr, prev) => {
      if (!prev || prev === 0) return null;
      const change = ((curr - prev) / prev) * 100;
      return { value: change, positive: change >= 0 };
    };
    const incomeChange = calcChange(monthTotals.totalIncome, previousPeriodTotals.totalIncome);
    const expensesChange = calcChange(monthTotals.totalExpenses, previousPeriodTotals.totalExpenses);
    return {
      income: incomeChange ? { ...incomeChange, positive: incomeChange.positive } : null,
      expenses: expensesChange ? { ...expensesChange, positive: !expensesChange.positive } : null, // Inverted: more expenses = bad (red)
      balance: monthTotals.balance >= 0
        ? { positive: true, label: 'Positive', change: calcChange(monthTotals.balance, previousPeriodTotals.balance) }
        : { positive: false, label: 'Negative', change: calcChange(monthTotals.balance, previousPeriodTotals.balance) },
    };
  }, [monthTotals, previousPeriodTotals]);

  const pieData = useMemo(() => {
    const map = new Map();
    for (const e of periodExpenses) {
      const name = (typeof e.category === 'object' && e.category) ? (e.category.name || t('expenseGeneric')) : (e.category || t('expenseGeneric'));
      const prev = map.get(name) || 0;
      map.set(name, prev + Number(e.amount || 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [periodExpenses, t]);

  // Only current selected period
  const barData = useMemo(() => {
    const label = (periodOptions.find((p) => p.value === effectivePeriod)?.label) || effectivePeriod;
    return [{ name: label, income: Number(monthTotals.totalIncome || 0), expenses: Number(monthTotals.totalExpenses || 0) }];
  }, [periodOptions, effectivePeriod, monthTotals]);

  function handleGoToIncome() {
    navigate('/income');
  }

  function handleGoToExpenses() {
    navigate('/expenses');
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('summaryTitle')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('summarySub')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGoToIncome}
            className="h-9 px-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            {t('addIncome')}
          </button>
          <button
            onClick={handleGoToExpenses}
            className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {t('addExpense')}
          </button>
          <select
            className="h-9 px-3 pr-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm appearance-none"
            value={periodType}
            onChange={(e) => {
              const v = e.target.value;
              setPeriodType(v);
              setSelectedPeriod(v === 'month' ? getCurrentYearMonth() : String(new Date().getFullYear()));
            }}
            aria-label={t('period')}
          >
            <option value="month">{t('periodMonth')}</option>
            <option value="year">{t('periodYear')}</option>
          </select>
          <select
            id="period-select"
            className="h-9 px-3 pr-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm appearance-none"
            value={effectivePeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {periodOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('totalIncome')}>
          <p className="text-3xl font-bold">${monthTotals.totalIncome.toFixed(2)}</p>
          {trends.income && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${trends.income.positive ? 'text-green-600' : 'text-red-500'}`}>
              <span className="material-symbols-outlined text-sm">{trends.income.positive ? 'trending_up' : 'trending_down'}</span>
              <span>{trends.income.positive ? '+' : '-'}{Math.abs(trends.income.value).toFixed(1)}%</span>
            </div>
          )}
        </Card>
        <Card title={t('totalExpenses')}>
          <p className="text-3xl font-bold">${monthTotals.totalExpenses.toFixed(2)}</p>
          {trends.expenses && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${trends.expenses.positive ? 'text-green-600' : 'text-red-500'}`}>
              <span className="material-symbols-outlined text-sm">{trends.expenses.positive ? 'trending_up' : 'trending_down'}</span>
              <span>{trends.expenses.positive ? '+' : '-'}{Math.abs(trends.expenses.value).toFixed(1)}%</span>
            </div>
          )}
        </Card>
        <Card title={t('netBalance')}>
          <p className="text-3xl font-bold">${monthTotals.balance.toFixed(2)}</p>
          {trends.balance && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${((trends.balance.change ? trends.balance.change.positive : trends.balance.positive) ? 'text-green-600' : 'text-red-500')}`}>
              {trends.balance.change ? (
                <>
                  <span className="material-symbols-outlined text-sm">{trends.balance.change.positive ? 'trending_up' : 'trending_down'}</span>
                  <span>{trends.balance.change.positive ? '+' : '-'}{Math.abs(trends.balance.change.value).toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">{trends.balance.positive ? 'check_circle' : 'cancel'}</span>
                  <span>{trends.balance.label}</span>
                </>
              )}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('incomeVsExpenses')} className="lg:col-span-2">
          {barData.length ? (
            <BarCompare data={barData} />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
          )}
        </Card>
        <Card title={t('expenseBreakdown')}>
          {pieData.length ? (
            <PieBreakdown data={pieData} />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
          )}
        </Card>
      </section>

      {/* Recent Transactions */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{t('recentTransactions')}</h3>
        </div>
        <div className="flow-root">
          <ul className="divide-y divide-gray-200 dark:divide-gray-800" role="list">
            {getRecentTransactions(periodIncome, periodExpenses, t).map((t) => (
              <li key={t.id} className="py-3 sm:py-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`flex items-center justify-center size-10 rounded-full ${t.kind === 'income' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                      <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">{t.icon}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-sm text-[#616f89] dark:text-gray-400 truncate">{t.category}</p>
                  </div>
                  <div className={`inline-flex items-center text-base font-semibold ${t.kind === 'income' ? 'text-green-600' : 'text-red-500'}`}>{t.displayAmount}</div>
                </div>
              </li>
            ))}
            {getRecentTransactions(periodIncome, periodExpenses, t).length === 0 && (
              <li className="py-2 text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function getRecentTransactions(income = [], expenses = [], t) {
  const incomeItems = income.map((i) => ({
    id: `i-${i.id ?? Math.random()}`,
    kind: 'income',
    title: i.source || t('incomeGeneric'),
    category: t('incomeGeneric'),
    amount: Number(String(i.amount || 0).toString().replace(/[^0-9.-]/g, '')),
    displayAmount: formatMoney(i.amount || 0, i.currency || 'USD', { sign: 'always' }),
    date: new Date(i.date || 0).getTime() || 0,
    icon: 'work',
  }));
  const expenseItems = expenses.map((e) => ({
    id: `e-${e.id ?? Math.random()}`,
    kind: 'expense',
    title: e.notes || t('expenseGeneric'),
    category: (typeof e.category === 'object' && e.category) ? (e.category.name || t('expenseGeneric')) : (e.category || t('expenseGeneric')),
    amount: -Number(String(e.amount || 0).toString().replace(/[^0-9.-]/g, '')),
    displayAmount: '-' + formatMoney(e.amount || 0, e.currency || 'USD', { sign: 'none' }),
    date: new Date(e.date || 0).getTime() || 0,
    icon: 'shopping_cart',
  }));

  return [...incomeItems, ...expenseItems]
    .sort((a, b) => b.date - a.date)
    .slice(0, 5);
}

function getCurrentYearMonth() {
  const now = new Date();
  
  // Try to get Argentina timezone first
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Argentina/Buenos_Aires', 
      year: 'numeric', 
      month: '2-digit' 
    });
    const parts = formatter.formatToParts(now);
    const yearPart = parts.find((p) => p.type === 'year');
    const monthPart = parts.find((p) => p.type === 'month');
    
    if (yearPart && monthPart) {
      const result = `${yearPart.value}-${monthPart.value}`;
      console.log('getCurrentYearMonth - Argentina timezone:', result, 'now:', now.toString());
      return result;
    }
  } catch (e) {
    console.log('getCurrentYearMonth - Intl failed:', e);
    // If Intl fails, fall through to local time
  }
  
  // Fallback: use local time (should work for most users in Argentina)
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const result = `${year}-${month}`;
  console.log('getCurrentYearMonth - fallback local:', result, 'now:', now.toString(), 'getMonth():', now.getMonth());
  return result;
}

function extractYearMonth(dateStr) {
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

function buildFullYearMonths(year, locale) {
  const arr = [];
  for (let m = 1; m <= 12; m += 1) {
    // Use a mid-month UTC date and fixed timezone to avoid month shifting by TZ
    const date = new Date(Date.UTC(year, m - 1, 15, 12, 0, 0));
    const label = new Intl.DateTimeFormat(locale || undefined, { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(date) + ` ${year}`;
    arr.push({ value: `${year}-${String(m).padStart(2, '0')}`, label });
  }
  // order descending to match previous behavior
  return arr.sort((a, b) => (a.value < b.value ? 1 : -1));
}

function buildAvailableYears(expenses = [], income = []) {
  const set = new Set();
  const add = (ts) => {
    const ym = extractYearMonth(ts);
    if (!ym) return;
    set.add(String(ym.year));
  };
  income.forEach((i) => add(i.date));
  expenses.forEach((e) => add(e.date));
  if (set.size === 0) set.add(String(new Date().getFullYear()));
  const values = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  return values.map((v) => ({ value: v, label: v }));
}

function filterByMonth(expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  const periodIncome = income.filter((i) => inMonth(i.date));
  const periodExpenses = expenses.filter((e) => inMonth(e.date));
  return { periodIncome, periodExpenses };
}

function filterByYear(expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  const periodIncome = income.filter((i) => inYear(i.date));
  const periodExpenses = expenses.filter((e) => inYear(e.date));
  return { periodIncome, periodExpenses };
}

function computeTotals(expenses = [], income = []) {
  const totalExpenses = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const totalIncome = income.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  return {
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
  };
}



