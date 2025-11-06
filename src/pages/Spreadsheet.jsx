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

// Helper component for inline editing
function EditableCell({ value, row, field, onSave, t, formatMonthYear }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const { updateExpense, updateIncome } = useApp();

  React.useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      const updates = {};
      
      // Convert value based on field type
      if (field === 'amount') {
        const numValue = parseFloat(String(editValue));
        if (isNaN(numValue) || numValue < 0) {
          // Revert if invalid
          setEditValue(value);
          setIsEditing(false);
          return;
        }
        updates.amount = numValue;
      } else if (field === 'date') {
        // Parse date and normalize to first day of month
        const date = new Date(editValue);
        if (!isNaN(date.getTime())) {
          const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0));
          updates.date = normalizedDate.toISOString();
        }
      } else if (field === 'currency') {
        updates.currency = editValue.toUpperCase();
      } else if (field === 'notes') {
        updates.notes = editValue || undefined;
      } else if (field === 'category') {
        updates.categoryName = editValue;
      }

      if (row.type === 'expense') {
        await updateExpense(row.id, updates);
      } else {
        await updateIncome(row.id, updates);
      }

      setIsEditing(false);
      if (onSave) onSave();
    } catch (error) {
      // Revert on error
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (!isEditing) {
    let displayValue = value;
    if (field === 'amount') {
      displayValue = formatMoney(value, row.currency || 'ARS', { sign: 'none' });
    } else if (field === 'date') {
      if (formatMonthYear) {
        displayValue = formatMonthYear(value);
      } else {
        // Fallback format if formatMonthYear not provided
        const date = typeof value === 'string' ? new Date(value) : value;
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          displayValue = `${String(month).padStart(2, '0')}/${year}`;
        } else {
          displayValue = '-';
        }
      }
    }

    return (
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-0.5 rounded min-w-[60px]"
        title={t('clickToEdit') || 'Click to edit'}
      >
        {displayValue || '-'}
      </div>
    );
  }

  // Render input based on field type
  if (field === 'amount') {
    return (
      <input
        type="number"
        step="0.01"
        value={editValue || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        autoFocus
      />
    );
  } else if (field === 'date') {
    // Format date for input (YYYY-MM format for month/year only)
    const date = new Date(value);
    const yearMonth = !isNaN(date.getTime()) 
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : '';
    
    return (
      <input
        type="month"
        value={yearMonth}
        onChange={(e) => {
          const [year, month] = e.target.value.split('-');
          const newDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 12, 0, 0, 0));
          setEditValue(newDate.toISOString());
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoFocus
      />
    );
  } else {
    return (
      <input
        type="text"
        value={editValue || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 border border-primary focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoFocus
      />
    );
  }
}

export default function Spreadsheet() {
  const { expenses, income, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterType, setFilterType] = useState('all'); // 'all', 'expense', 'income'
  const [filterCategory, setFilterCategory] = useState(location.state?.filterCategory || null);
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
  const months = useMemo(() => buildFullYearMonths(selectedYear, 'es-AR'), [selectedYear]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;
  
  // Clear navigation state after applying filter
  useEffect(() => {
    if (location.state?.filterCategory) {
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
      category: e.category?.name || '',
      concept: e.name || e.notes || '',
      amount: e.amount,
      date: e.date,
      notes: e.notes || '',
      rawDate: typeof e.date === 'string' ? e.date : new Date(e.date).toISOString(),
    }));

    const incomeRows = (periodIncome || []).map((i) => ({
      id: i.id,
      type: 'income',
      category: i.category?.name || i.source || '',
      concept: i.notes || i.source || '',
      amount: i.amount,
      date: i.date,
      notes: i.notes || '',
      rawDate: typeof i.date === 'string' ? i.date : new Date(i.date).toISOString(),
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
    return data;
  }, [allData, filterType, filterCategory]);

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
      const mf = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' });
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            
            {filterCategory && (
              <button
                onClick={() => setFilterCategory(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('clearAllFilters')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[#616f89] dark:text-gray-400">{t('period')}:</label>
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
          </div>
        </div>
      </Card>

      <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
        <div className="min-w-full" style={{ minWidth: '1200px' }}>
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('type')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-2">
                    {t('category')} {getSortIcon('category')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('concept') || 'Concepto'}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center gap-2">
                    {t('amount')} {getSortIcon('amount')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    {t('date')} {getSortIcon('date')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
                  {t('notes')}
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
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      {row.type === 'income' ? t('income') : t('expense')}
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
                      {row.concept || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      <EditableCell
                        value={row.amount}
                        type={row.type}
                        row={row}
                        field="amount"
                        onSave={() => {}}
                        t={t}
                        formatMonthYear={formatMonthYear}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900">
                      <div className="flex items-center gap-2">
                        <EditableCell
                          value={row.date}
                          type={row.type}
                          row={row}
                          field="date"
                          onSave={() => {}}
                          t={t}
                          formatMonthYear={formatMonthYear}
                        />
                        <button
                          type="button"
                          className="hover:underline hover:text-primary text-xs"
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
                          🔍
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-900 max-w-xs">
                      <EditableCell
                        value={row.notes || ''}
                        type={row.type}
                        row={row}
                        field="notes"
                        onSave={() => {}}
                        t={t}
                        formatMonthYear={formatMonthYear}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-sm text-[#616f89] dark:text-gray-400">
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
