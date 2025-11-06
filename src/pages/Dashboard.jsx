import React, {useMemo, useState} from 'react';
import Card from '../components/Card.jsx';
import {useApp} from '../context/AppContext.jsx';
import {formatMoney} from '../utils/format.js';
import {useNavigate} from 'react-router-dom';
import {BarCompare, PieBreakdown} from '../components/Chart.jsx';
import Select from '../components/Select.jsx';

export default function Dashboard() {
  const { expenses, income, investmentSummary, t, locale } = useApp();
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
    return result;
  }, [periodOptions, selectedPeriod, currentMonth, periodType]);

  const { periodExpenses, periodIncome } = useMemo(() => {
    return periodType === 'month'
      ? filterByMonth(expenses, income, effectivePeriod)
      : filterByYear(expenses, income, Number(effectivePeriod));
  }, [expenses, income, periodType, effectivePeriod]);

  const monthTotals = useMemo(() => computeTotals(periodExpenses, periodIncome, investmentSummary), [periodExpenses, periodIncome, investmentSummary]);

  const previousPeriodTotals = useMemo(() => {
    let prevPeriod;
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
    return computeTotals(prev.periodExpenses, prev.periodIncome, investmentSummary);
  }, [periodType, effectivePeriod, expenses, income, investmentSummary]);

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
      const amount = Number(e.amount || 0);
      // Only add valid, positive numbers
      if (!isNaN(amount) && isFinite(amount) && amount > 0) {
        const prev = map.get(name) || 0;
        map.set(name, prev + amount);
      }
    }
    
    // Convert to array and filter out zero values
    let allData = Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter(item => item.value > 0);
    
    if (allData.length === 0) return [];
    
    // Calculate total
    const total = allData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];
    
    // Group small categories (less than 2% of total) into "Otros"
    const threshold = total * 0.02; // 2% threshold
    const mainCategories = [];
    let othersSum = 0;
    
    for (const item of allData) {
      if (item.value >= threshold) {
        mainCategories.push(item);
      } else {
        othersSum += item.value;
      }
    }
    
    // Sort main categories by value descending
    mainCategories.sort((a, b) => b.value - a.value);
    
    // Add "Otros" category if there are small categories
    if (othersSum > 0) {
      mainCategories.push({ name: t('others') || 'Otros', value: othersSum });
    }
    
    return mainCategories;
  }, [periodExpenses, t]);

  // Only current selected period
  const barData = useMemo(() => {
    const label = (periodOptions.find((p) => p.value === effectivePeriod)?.label) || effectivePeriod;
    const incomeValue = Math.abs(Number(monthTotals.totalIncome || 0));
    const expensesValue = Math.abs(Number(monthTotals.totalExpenses || 0));
    // Both income and expenses should be positive to appear above zero line
    return [{ name: label, income: incomeValue, expenses: expensesValue }];
  }, [periodOptions, effectivePeriod, monthTotals]);


  function handleGoToIncome() {
    navigate('/income', { state: { openForm: true } });
  }

  function handleGoToExpenses() {
    navigate('/expenses', { state: { openForm: true } });
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
          <Select
            value={periodType}
            onChange={(v) => {
              setPeriodType(v);
              setSelectedPeriod(v === 'month' ? getCurrentYearMonth() : String(new Date().getFullYear()));
            }}
            options={[
              { value: 'month', label: t('periodMonth') },
              { value: 'year', label: t('periodYear') },
            ]}
          />
          <Select
            value={effectivePeriod}
            onChange={(v) => setSelectedPeriod(v)}
            options={periodOptions}
          />
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('totalIncome')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoney(monthTotals.totalIncome, 'ARS', { sign: 'none' })}
          </p>
          {trends.income && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${trends.income.positive ? 'text-green-600' : 'text-red-500'}`}>
              <span className="material-symbols-outlined text-sm">{trends.income.positive ? 'trending_up' : 'trending_down'}</span>
              <span>{trends.income.positive ? '+' : '-'}{Math.abs(trends.income.value).toFixed(1)}%</span>
            </div>
          )}
        </Card>
        <Card title={t('totalExpenses')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoney(monthTotals.totalExpenses, 'ARS', { sign: 'none' })}
          </p>
          {trends.expenses && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${trends.expenses.positive ? 'text-green-600' : 'text-red-500'}`}>
              <span className="material-symbols-outlined text-sm">{trends.expenses.positive ? 'trending_up' : 'trending_down'}</span>
              <span>{trends.expenses.positive ? '+' : '-'}{Math.abs(trends.expenses.value).toFixed(1)}%</span>
            </div>
          )}
        </Card>
        <Card title={t('netBalance')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoney(monthTotals.balance, 'ARS')}
          </p>
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
            <PieBreakdown 
              data={pieData} 
              onCategoryClick={(categoryName) => {
                navigate('/spreadsheet', { state: { filterCategory: categoryName } });
              }}
            />
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
                    <div className={`flex items-center justify-center size-10 rounded-full ${t.kind === 'income' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-orange-100 dark:bg-orange-900/40'}`}>
                      <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">{t.icon}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-sm text-[#616f89] dark:text-gray-400 truncate">
                      {t.category}
                    </p>
                  </div>
                  <div className={`inline-flex items-center text-base font-semibold ${t.kind === 'income' ? 'text-green-600' : 'text-orange-500'}`}>{t.displayAmount}</div>
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
    displayAmount: formatMoney(i.amount || 0, i.currency || 'ARS', { sign: 'always' }),
    date: new Date(i.date || 0).getTime() || 0,
    icon: 'work',
  }));
  const expenseItems = expenses.map((e) => ({
    id: `e-${e.id ?? Math.random()}`,
    kind: 'expense',
    title: e.notes || t('expenseGeneric'),
    category: (typeof e.category === 'object' && e.category) ? (e.category.name || t('expenseGeneric')) : (e.category || t('expenseGeneric')),
    amount: -Number(String(e.amount || 0).toString().replace(/[^0-9.-]/g, '')),
    displayAmount: '-' + formatMoney(e.amount || 0, e.currency || 'ARS', { sign: 'none' }),
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
      return `${yearPart.value}-${monthPart.value}`;
    }
  } catch (e) {
    // If Intl fails, fall through to local time
  }
  
  // Fallback: use local time (should work for most users in Argentina)
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
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
    const raw = new Intl.DateTimeFormat(locale || 'es-AR', { month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(date);
    const three = raw.replace('.', '').slice(0, 3);
    const monthAbbr = three.charAt(0).toUpperCase() + three.slice(1);
    const label = `${monthAbbr} ${year}`;
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
  
  // Filter expenses: only those in the specific month
  const periodExpenses = expenses.filter((e) => inMonth(e.date));
  
  // Filter income: include both regular income in the month AND recurring income that started before or in this month
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started on or before this month
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      // Include if the recurring income started in this month or earlier
      return (incomeYm.year < y) || (incomeYm.year === y && incomeYm.month <= m);
    }
    // For non-recurring income, only include if it's in this month
    return inMonth(i.date);
  });
  
  return { periodIncome, periodExpenses };
}

function filterByYear(expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  
  // Filter expenses: only those in the specific year
  const periodExpenses = expenses.filter((e) => inYear(e.date));
  
  // Filter income: include both regular income in the year AND recurring income that started before or in this year
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started in this year or earlier
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      return incomeYm.year <= year;
    }
    // For non-recurring income, only include if it's in this year
    return inYear(i.date);
  });
  
  return { periodIncome, periodExpenses };
}

function computeTotals(expenses = [], income = [], investmentSummary = null) {
  // Ensure expenses are always positive (some data might have negative values)
  const totalExpenses = expenses.reduce((acc, r) => {
    const amount = Number(r.amount || 0);
    // Use absolute value to ensure expenses are always positive
    return acc + Math.abs(amount);
  }, 0);
  const totalIncome = income.reduce((acc, r) => {
    const amount = Number(r.amount || 0);
    // Ensure income is always positive
    return acc + Math.abs(amount);
  }, 0);
  // Add investment profit as income (only profit, not total value)
  const investmentProfit = investmentSummary ? (Number(investmentSummary.profit || 0)) : 0;
  const totalIncomeWithInvestments = totalIncome + investmentProfit;
  return {
    totalExpenses,
    totalIncome: totalIncomeWithInvestments,
    balance: totalIncomeWithInvestments - totalExpenses,
  };
}



