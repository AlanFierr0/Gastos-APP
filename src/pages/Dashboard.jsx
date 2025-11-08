import React, {useMemo, useState} from 'react';
import Card from '../components/Card.jsx';
import {useApp} from '../context/AppContext.jsx';
import {formatMoneyNoDecimals, capitalizeWords, formatNumber, extractYearMonth} from '../utils/format.js';
import {useNavigate} from 'react-router-dom';
import {BarCompare, PieBreakdown} from '../components/Chart.jsx';
import CustomSelect from '../components/CustomSelect.jsx';

export default function Dashboard() {
  const { expenses, income, t } = useApp();
  const [periodType, setPeriodType] = useState('month'); // 'month' | 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(() => getLastNonForecastMonth());
  const navigate = useNavigate();
  
  // Calculate current month on each render to ensure it's always fresh
  const lastNonForecastMonth = useMemo(() => getLastNonForecastMonth(), []);

  // (moved below, after periodOptions declaration)

  // Determine selected year for month mode
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || lastNonForecastMonth).split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod, lastNonForecastMonth]);

  // Build 12 months for the selected year (always available)
  const months = useMemo(() => buildFullYearMonths(selectedYear, 'es-AR'), [selectedYear]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;

  // Ensure a valid month only when switching to month mode or when options update
  React.useEffect(() => {
    if (periodType !== 'month') return;
    const isValid = Array.isArray(periodOptions) && periodOptions.some((p) => p.value === selectedPeriod);
    if (!isValid) setSelectedPeriod(lastNonForecastMonth);
  }, [periodType, periodOptions, selectedPeriod, lastNonForecastMonth]);

  // Always use last non-forecast month if selectedPeriod is not in options (for initial load)
  const effectivePeriod = useMemo(() => {
    let result;
    if (periodOptions.length) {
      const isInOptions = periodOptions.some((p) => p.value === selectedPeriod);
      result = isInOptions ? selectedPeriod : (periodType === 'month' ? lastNonForecastMonth : periodOptions[0].value);
    } else {
      result = periodType === 'month' ? lastNonForecastMonth : String(new Date().getFullYear());
    }
    return result;
  }, [periodOptions, selectedPeriod, lastNonForecastMonth, periodType]);

  // Check if the selected period is forecast (only for month view)
  const isForecastPeriod = useMemo(() => {
    if (periodType === 'month') {
      const [yStr, mStr] = (effectivePeriod || '').split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (y && m) {
        return isForecastMonth(y, m);
      }
    }
    // For year view, never show forecast warning - always use real data only
    return false;
  }, [periodType, effectivePeriod]);

  const { periodExpenses, periodIncome } = useMemo(() => {
    // For month view: if it's a forecast period, include forecast data; otherwise exclude it
    // For year view: always exclude forecast data (only show real data)
    return periodType === 'month'
      ? (isForecastPeriod 
          ? filterByMonthIncludingForecast(expenses, income, effectivePeriod)
          : filterByMonth(expenses, income, effectivePeriod))
      : filterByYear(expenses, income, Number(effectivePeriod)); // Always exclude forecast for year view
  }, [expenses, income, periodType, effectivePeriod, isForecastPeriod]);

  const monthTotals = useMemo(() => computeTotals(periodExpenses, periodIncome), [periodExpenses, periodIncome]);

  const previousPeriodTotals = useMemo(() => {
    let prevPeriod;
    let prevPeriodLabel;
    if (periodType === 'month') {
      const [y, m] = effectivePeriod.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y, m - 2, 1));
      prevPeriod = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
      // Get label from periodOptions
      const prevOption = periodOptions.find((p) => p.value === prevPeriod);
      prevPeriodLabel = prevOption?.label || prevPeriod;
    } else {
      prevPeriod = String(Number(effectivePeriod) - 1);
      prevPeriodLabel = prevPeriod;
    }
    if (!prevPeriod) return null;
    const prev = periodType === 'month'
      ? filterByMonth(expenses, income, prevPeriod)
      : filterByYear(expenses, income, Number(prevPeriod));
    const totals = computeTotals(prev.periodExpenses, prev.periodIncome);
    return { ...totals, periodLabel: prevPeriodLabel };
  }, [periodType, effectivePeriod, expenses, income, periodOptions]);

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
    const comparisonLabel = periodType === 'month' 
      ? (t('vsPreviousMonth') || 'vs. Mes anterior')
      : (t('vsPreviousYear') || 'vs. Año anterior');
    return {
      income: incomeChange ? { 
        ...incomeChange, 
        positive: incomeChange.positive,
        previousValue: previousPeriodTotals.totalIncome,
        comparisonLabel 
      } : null,
      expenses: expensesChange ? { 
        ...expensesChange, 
        positive: !expensesChange.positive, // Inverted: more expenses = bad (red)
        previousValue: previousPeriodTotals.totalExpenses,
        comparisonLabel
      } : null,
      balance: monthTotals.balance >= 0
        ? { 
            positive: true, 
            label: 'Positive', 
            change: calcChange(monthTotals.balance, previousPeriodTotals.balance),
            previousValue: previousPeriodTotals.balance,
            comparisonLabel
          }
        : { 
            positive: false, 
            label: 'Negative', 
            change: calcChange(monthTotals.balance, previousPeriodTotals.balance),
            previousValue: previousPeriodTotals.balance,
            comparisonLabel
          },
    };
  }, [monthTotals, previousPeriodTotals, periodType, t]);

  const { pieData, othersCategories } = useMemo(() => {
    // Sumar exactamente como en la Grilla: montos crudos por categoría
    const map = new Map();
    for (const e of (periodExpenses || [])) {
      const name = (typeof e.category === 'object' && e.category)
        ? (e.category.name || t('expenseGeneric'))
        : (e.category || t('expenseGeneric'));
      const amount = Number(e.amount || 0);
      if (!isNaN(amount) && isFinite(amount)) {
        map.set(name, (map.get(name) || 0) + amount);
      }
    }

    // Convertir a array y mantener solo categorías con total positivo
    let allData = Array.from(map.entries())
      .map(([name, value]) => ({ name: capitalizeWords(name), value: Number(value), originalName: name }))
      .filter(item => item.value > 0);

    if (allData.length === 0) return { pieData: [], othersCategories: [] };

    // Total para umbral de "Otros"
    const total = allData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return { pieData: [], othersCategories: [] };

    const threshold = total * 0.02; // 2%
    const mainCategories = [];
    let othersSum = 0;
    const othersCats = [];

    for (const item of allData) {
      if (item.value >= threshold) {
        mainCategories.push({ name: item.name, value: item.value });
      } else {
        othersSum += item.value;
        othersCats.push(item.originalName);
      }
    }

    mainCategories.sort((a, b) => b.value - a.value);
    if (othersSum > 0) mainCategories.push({ name: t('others') || 'Otros', value: othersSum });

    return { pieData: mainCategories, othersCategories: othersCats };
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
          <CustomSelect
            value={periodType}
            onChange={(v) => {
              setPeriodType(v);
              setSelectedPeriod(v === 'month' ? lastNonForecastMonth : String(new Date().getFullYear()));
            }}
            options={[
              { value: 'month', label: t('periodMonth') },
              { value: 'year', label: t('periodYear') },
            ]}
          />
          <CustomSelect
            value={effectivePeriod}
            onChange={(v) => setSelectedPeriod(v)}
            options={periodOptions}
          />
        </div>
      </header>

      {isForecastPeriod && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 flex-shrink-0">warning</span>
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">{t('forecastWarning') || 'Este es un mes pronóstico'}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{t('forecastWarningMessage') || 'No hay datos reales para este período. Los valores mostrados son pronósticos.'}</p>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('totalIncome')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.totalIncome, 'ARS', { sign: 'none' })}
          </p>
          {trends.income && (
            <div className="mt-2 space-y-1">
              <div className={`flex items-center gap-1 text-sm ${trends.income.positive ? 'text-green-600' : 'text-red-500'}`}>
                <span className="material-symbols-outlined text-sm">{trends.income.positive ? 'trending_up' : 'trending_down'}</span>
                <span>{trends.income.positive ? '+' : '-'}{formatNumber(Math.abs(trends.income.value), 1)}%</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {trends.income.comparisonLabel}: {formatMoneyNoDecimals(trends.income.previousValue, 'ARS', { sign: 'none' })}
              </div>
            </div>
          )}
        </Card>
        <Card title={t('totalExpenses')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.totalExpenses, 'ARS', { sign: 'none' })}
          </p>
          {trends.expenses && (
            <div className="mt-2 space-y-1">
              <div className={`flex items-center gap-1 text-sm ${trends.expenses.positive ? 'text-green-600' : 'text-red-500'}`}>
                <span className="material-symbols-outlined text-sm">{trends.expenses.positive ? 'trending_up' : 'trending_down'}</span>
                <span>{trends.expenses.positive ? '+' : '-'}{formatNumber(Math.abs(trends.expenses.value), 1)}%</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {trends.expenses.comparisonLabel}: {formatMoneyNoDecimals(trends.expenses.previousValue, 'ARS', { sign: 'none' })}
              </div>
            </div>
          )}
        </Card>
        <Card title={t('netBalance')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.balance, 'ARS')}
          </p>
          {trends.balance && (
            <div className="mt-2 space-y-1">
              {trends.balance.change ? (
                <>
                  <div className={`flex items-center gap-1 text-sm ${trends.balance.change.positive ? 'text-green-600' : 'text-red-500'}`}>
                    <span className="material-symbols-outlined text-sm">{trends.balance.change.positive ? 'trending_up' : 'trending_down'}</span>
                    <span>{trends.balance.change.positive ? '+' : '-'}{formatNumber(Math.abs(trends.balance.change.value), 1)}%</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {trends.balance.comparisonLabel}: {formatMoneyNoDecimals(trends.balance.previousValue, 'ARS')}
                  </div>
                </>
              ) : (
                <div className={`flex items-center gap-1 text-sm ${trends.balance.positive ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-sm">{trends.balance.positive ? 'check_circle' : 'cancel'}</span>
                  <span>{trends.balance.label}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('incomeVsExpenses')} className="lg:col-span-2">
          {barData.length ? (
            <BarCompare 
              data={barData} 
              tooltipLabelFromDatum={false}
              customTooltip={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const isDark = document.documentElement.classList.contains('dark');
                  return (
                    <div 
                      className={`rounded-lg border p-2 shadow-lg z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                      style={isDark ? { backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(55 65 81)' } : {}}
                    >
                      {payload.map((entry, index) => {
                        const absValue = Math.abs(entry.value || 0);
                        const formatted = absValue.toLocaleString('es-AR', { 
                          style: 'currency', 
                          currency: 'ARS',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        });
                        // Translate the label
                        let label = entry.name || '';
                        if (label.toLowerCase() === 'income') {
                          label = t('incomeGeneric') || 'Ingreso';
                        } else if (label.toLowerCase() === 'expenses') {
                          label = t('expenseGeneric') || 'Gasto';
                        }
                        return (
                          <p 
                            key={index} 
                            className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                            style={isDark ? { color: 'rgb(243 244 246)', backgroundColor: 'transparent' } : {}}
                          >
                            <span style={{ color: entry.color || (isDark ? 'rgb(243 244 246)' : '#000') }} className="category-name">{label}: </span>
                            {formatted}
                          </p>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
          )}
        </Card>
        <Card title={t('expenseBreakdown')}>
          {pieData.length ? (
            <PieBreakdown 
              data={pieData} 
              onCategoryClick={(categoryName) => {
                // If clicking on "Otros", pass all the categories that form it
                if (categoryName === (t('others') || 'Otros')) {
                  navigate('/spreadsheet', { state: { filterCategories: othersCategories } });
                } else {
                  navigate('/spreadsheet', { state: { filterCategory: categoryName } });
                }
              }}
            />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
          )}
        </Card>
      </section>
    </div>
  );
}
function getLastNonForecastMonth() {
  const now = new Date();
  let year, month;
  
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
      year = Number(yearPart.value);
      month = Number(monthPart.value);
    } else {
      // Fallback: use local time
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
  } catch (e) {
    // Fallback: use local time if Intl fails
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  
  // Current month is always forecast (month >= current month), so go back one month
  // This gives us the last completed month
  month--;
  if (month < 1) {
    month = 12;
    year--;
  }
  
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isForecastMonth(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If year is in the future, it's forecast
  if (year > currentYear) return true;
  // If year is in the past, it's not forecast
  if (year < currentYear) return false;
  // If same year, month >= current month is forecast
  return month >= currentMonth;
}


function buildFullYearMonths(year) {
  const arr = [];
  for (let m = 1; m <= 12; m += 1) {
    // Use a mid-month UTC date and fixed timezone to avoid month shifting by TZ
    const date = new Date(Date.UTC(year, m - 1, 15, 12, 0, 0));
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(date);
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
  
  // Filter expenses: only those in the specific month AND not forecast
  const periodExpenses = expenses.filter((e) => {
    const ym = extractYearMonth(e.date);
    if (!ym) return false;
    if (!inMonth(e.date)) return false;
    // Exclude forecast months
    return !isForecastMonth(ym.year, ym.month);
  });
  
  // Filter income: include both regular income in the month AND recurring income that started before or in this month
  // But exclude forecast months
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started on or before this month
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      // Include if the recurring income started in this month or earlier
      const matches = (incomeYm.year < y) || (incomeYm.year === y && incomeYm.month <= m);
      if (!matches) return false;
      // Exclude if the selected month is forecast
      return !isForecastMonth(y, m);
    }
    // For non-recurring income, only include if it's in this month and not forecast
    const ym = extractYearMonth(i.date);
    if (!ym || !inMonth(i.date)) return false;
    return !isForecastMonth(ym.year, ym.month);
  });
  
  return { periodIncome, periodExpenses };
}

function filterByYear(expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  
  // Filter expenses: only those in the specific year AND not forecast
  const periodExpenses = expenses.filter((e) => {
    const ym = extractYearMonth(e.date);
    if (!ym || !inYear(e.date)) return false;
    // Exclude forecast months
    return !isForecastMonth(ym.year, ym.month);
  });
  
  // Filter income: include both regular income in the year AND recurring income that started before or in this year
  // But exclude forecast months
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started in this year or earlier
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      if (incomeYm.year > year) return false;
      // For recurring income, we need to check if any month in the year is forecast
      // Since we're filtering by year, we'll exclude if the year is current and has forecast months
      const now = new Date();
      const currentYear = now.getFullYear();
      if (year === currentYear) {
        // For current year, exclude if the recurring income would fall in forecast months
        // This is a simplification - we'll exclude all recurring income for current year
        // if any month in the year is forecast
        // If we're in the current year and there are forecast months, exclude recurring income
        // that would contribute to forecast months
        return true; // We'll handle this more carefully by checking the actual month
      }
      return true;
    }
    // For non-recurring income, only include if it's in this year and not forecast
    const ym = extractYearMonth(i.date);
    if (!ym || !inYear(i.date)) return false;
    return !isForecastMonth(ym.year, ym.month);
  });
  
  return { periodIncome, periodExpenses };
}

function filterByMonthIncludingForecast(expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  
  // Filter expenses: only those in the specific month (including forecast)
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

function computeTotals(expenses = [], income = []) {
  // Match Grilla: sumar montos crudos (sin valor absoluto)
  const totalExpenses = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const totalIncome = income.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  return {
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
  };
}



