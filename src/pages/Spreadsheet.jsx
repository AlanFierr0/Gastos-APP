import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';
import Card from '../components/Card.jsx';
import Select from '../components/Select.jsx';
import { useLocation, useNavigate } from 'react-router-dom';

// Generate a deterministic color for a category name
function getCategoryColor(categoryName) {
  if (!categoryName) return '#9ca3af'; // Gray for empty categories
  
  // Create a hash from the category name
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use golden angle distribution for good color separation
  const goldenAngle = 137.508;
  const hue = (Math.abs(hash) * goldenAngle) % 360;
  const saturation = 55 + (Math.abs(hash) % 35); // 55-90%
  const lightness = 45 + (Math.abs(hash >> 8) % 20); // 45-65%
  
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}



export default function Spreadsheet() {
  const { expenses, income, persons, t, locale } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Create a map of person IDs to person objects for quick lookup
  const personMap = useMemo(() => {
    const map = new Map();
    (persons || []).forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income'
  const [filterCategory, setFilterCategory] = useState(location.state?.filterCategory || null);
  const [filterPersonId, setFilterPersonId] = useState(location.state?.filterPersonId || null);
  const [periodType, setPeriodType] = useState('all'); // 'all', 'month', 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentYearMonth());
  
  // Calculate current month on each render to ensure it's always fresh
  const currentMonth = getCurrentYearMonth();
  
  // Determine selected year for month mode
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || currentMonth).split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod, currentMonth]);
  
  // Build 12 months for the selected year (always available)
  const months = useMemo(() => buildFullYearMonths(selectedYear, locale), [selectedYear, locale]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;
  
  // Clear navigation state after applying filter
  useEffect(() => {
    if (location.state?.filterCategory || location.state?.filterPersonId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Filter expenses and income by period first
  const { periodExpenses, periodIncome } = useMemo(() => {
    if (periodType === 'all') {
      return { periodExpenses: expenses || [], periodIncome: income || [] };
    } else if (periodType === 'month') {
      return filterByMonth(expenses || [], income || [], selectedPeriod);
    } else {
      return filterByYear(expenses || [], income || [], Number(selectedPeriod));
    }
  }, [expenses, income, periodType, selectedPeriod]);

  // Combine expenses and income into a unified dataset
  const allData = useMemo(() => {
    const expenseRows = (periodExpenses || []).map((e) => ({
      id: e.id,
      type: 'expense',
      typeLabel: t('expense'),
      category: e.category?.name || '',
      amount: e.amount,
      currency: e.currency || 'ARS',
      date: e.date,
      notes: e.notes || '',
      person: e.person?.name || '',
      personId: e.personId,
      source: '',
      rawDate: typeof e.date === 'string' ? e.date : new Date(e.date).toISOString(),
    }));

    const incomeRows = (periodIncome || []).map((i) => ({
      id: i.id,
      type: 'income',
      typeLabel: i.isRecurring ? t('recurringIncome') : t('income'),
      category: i.category?.name || '',
      amount: i.amount,
      currency: i.currency || 'ARS',
      date: i.date,
      notes: '',
      person: i.person?.name || '',
      personId: i.personId,
      source: i.source || '',
      rawDate: typeof i.date === 'string' ? i.date : new Date(i.date).toISOString(),
      isRecurring: i.isRecurring || false,
    }));

    return [...expenseRows, ...incomeRows];
  }, [periodExpenses, periodIncome, t]);

  // Filter data
  const filteredData = useMemo(() => {
    let data = allData;
    if (filterType !== 'all') {
      data = data.filter((d) => d.type === filterType);
    }
    if (filterCategory) {
      data = data.filter((d) => d.category === filterCategory);
    }
    if (filterPersonId) {
      data = data.filter((d) => d.personId === filterPersonId);
    }
    return data;
  }, [allData, filterType, filterCategory, filterPersonId]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.rawDate || a.date).getTime();
          bVal = new Date(b.rawDate || b.date).getTime();
          break;
        case 'amount':
          aVal = Number(a.amount) || 0;
          bVal = Number(b.amount) || 0;
          break;
        case 'category':
          aVal = String(a.category || '').toLowerCase();
          bVal = String(b.category || '').toLowerCase();
          break;
        case 'person':
          aVal = String(a.person || '').toLowerCase();
          bVal = String(b.person || '').toLowerCase();
          break;
        case 'type':
          aVal = String(a.type || '').toLowerCase();
          bVal = String(b.type || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  // Format date as abbreviated month (3 letters) and year, e.g., "Nov 2025"
  function formatMonthYear(value) {
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return String(value || '');
      const mf = new Intl.DateTimeFormat(locale || 'es-AR', { month: 'short', year: 'numeric' });
      const out = mf.format(d);
      return out.charAt(0).toUpperCase() + out.slice(1);
    } catch {
      return String(value || '');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('spreadsheetTitle')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('spreadsheetSubtitle')}</p>
        </div>
        {sortedData.length > 0 && (
          <div className="text-sm text-[#616f89] dark:text-gray-400">
            {t('totalRecords')}: <strong className="text-gray-700 dark:text-gray-200">{sortedData.length}</strong>
          </div>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[#616f89] dark:text-gray-400">{t('type')}:</label>
          <Select
            value={filterType}
            onChange={(v) => setFilterType(v)}
            options={[
              { value: 'all', label: t('allOption') },
              { value: 'expense', label: t('expense') },
              { value: 'income', label: t('income') },
            ]}
          />
          
          <label className="text-sm text-[#616f89] dark:text-gray-400 ml-2">{t('period')}:</label>
          <Select
            value={periodType}
            onChange={(v) => {
              setPeriodType(v);
              if (v === 'month') setSelectedPeriod(currentMonth);
              else if (v === 'year') setSelectedPeriod(String(new Date().getFullYear()));
            }}
            options={[
              { value: 'all', label: t('allOption') },
              { value: 'month', label: t('periodMonth') },
              { value: 'year', label: t('periodYear') },
            ]}
          />
          
          {periodType !== 'all' && periodOptions.length > 0 && (
            <Select
              value={selectedPeriod}
              onChange={(v) => setSelectedPeriod(v)}
              options={periodOptions}
            />
          )}
          
          {filterCategory && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(filterCategory) }} />
              <span>{filterCategory}</span>
              <button
                onClick={() => setFilterCategory(null)}
                className="ml-1 hover:opacity-70 transition-opacity"
                title={t('clearFilter')}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          
          {filterPersonId && personMap.has(filterPersonId) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm">
              <span 
                className="material-symbols-outlined text-sm" 
                style={{ color: personMap.get(filterPersonId)?.color || '#3b82f6' }}
              >
                {personMap.get(filterPersonId)?.icon || 'person'}
              </span>
              <span>{personMap.get(filterPersonId)?.name}</span>
              <button
                onClick={() => setFilterPersonId(null)}
                className="ml-1 hover:opacity-70 transition-opacity"
                title={t('clearFilter')}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          
          {(filterCategory || filterPersonId) && (
            <button
              onClick={() => {
                setFilterCategory(null);
                setFilterPersonId(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('clearAllFilters')}
            </button>
          )}
        </div>
      </Card>

      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
        <div className="min-w-full" style={{ minWidth: '1200px' }}>
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    {t('date')} {getSortIcon('date')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    {t('category')} {getSortIcon('category')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('person')}
                >
                  <div className="flex items-center gap-2">
                    {t('person')} {getSortIcon('person')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    {t('amount')} {getSortIcon('amount')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('currency')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('type')}
                >
                  <div className="flex items-center gap-2">
                    {t('type')} {getSortIcon('type')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('notes')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('source')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {sortedData.length > 0 ? (
                sortedData.map((row) => (
                  <tr
                    key={`${row.type}-${row.id}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      <button
                        type="button"
                        className="hover:underline hover:text-primary"
                        onClick={() => {
                          const ym = extractYearMonth(row.date);
                          if (ym) {
                            const value = `${String(ym.year)}-${String(ym.month).padStart(2, '0')}`;
                            if (periodType === 'month' && selectedPeriod === value) {
                              setPeriodType('all');
                            } else {
                              setPeriodType('month');
                              setSelectedPeriod(value);
                            }
                          }
                        }}
                        title={`${t('filterBy')} ${formatMonthYear(row.date)}`}
                      >
                        {formatMonthYear(row.date)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      <div className="flex items-center gap-2">
                        {row.category ? (
                          <>
                            <button
                              onClick={() => setFilterCategory(filterCategory === row.category ? null : row.category)}
                              className={`inline-block w-3 h-3 rounded-full flex-shrink-0 transition-all hover:scale-125 cursor-pointer ${
                                filterCategory === row.category ? 'ring-2 ring-primary ring-offset-1' : ''
                              }`}
                              style={{ backgroundColor: getCategoryColor(row.category) }}
                              title={`${t('filterBy')} ${row.category}`}
                            />
                            <span>{row.category}</span>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      {row.personId && personMap.has(row.personId) ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setFilterPersonId(filterPersonId === row.personId ? null : row.personId)}
                            className={`material-symbols-outlined text-lg transition-all hover:scale-110 cursor-pointer ${
                              filterPersonId === row.personId ? 'ring-2 ring-primary ring-offset-1 rounded' : ''
                            }`}
                            style={{ 
                              color: personMap.get(row.personId)?.color || '#3b82f6'
                            }}
                            title={`${t('filterBy')} ${row.person}`}
                          >
                            {personMap.get(row.personId)?.icon || 'person'}
                          </button>
                          <span>{row.person}</span>
                        </div>
                      ) : row.person ? (
                        <div className="flex items-center gap-2">
                          <span 
                            className="material-symbols-outlined text-lg" 
                            style={{ color: '#3b82f6' }}
                          >
                            person
                          </span>
                          <span>{row.person}</span>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      {formatMoney(row.amount, row.currency, { sign: 'none' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-900">
                      {row.currency || 'ARS'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          row.type === 'expense'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900 max-w-xs truncate">
                      {row.notes || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      {row.source || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-sm text-[#616f89] dark:text-gray-400">
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Utility functions for date handling
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
