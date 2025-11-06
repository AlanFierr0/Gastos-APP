import React, { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { formatMoney } from '../utils/format.js';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatDate } from '../utils/format.js';
import { useLocation } from 'react-router-dom';

export default function Expenses() {
  const { expenses, addExpense, updateExpense, removeExpense, t, categories, locale } = useApp();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [periodType, setPeriodType] = useState('all'); // all | month | year
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentYearMonth());
  const [showForm, setShowForm] = useState(location.state?.openForm || false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const [catQuery, setCatQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Clear navigation state after opening form
  useEffect(() => {
    if (location.state?.openForm) {
      // Clear the state to prevent reopening on back navigation
      window.history.replaceState({}, document.title);
    }
    // Apply incoming filters (from Dashboard or elsewhere)
    if (location.state?.periodType) {
      setPeriodType(location.state.periodType);
    }
    if (location.state?.selectedPeriod) {
      setSelectedPeriod(location.state.selectedPeriod);
    }
    if (location.state?.filterCategoryId) {
      setCategoryFilter(location.state.filterCategoryId);
    }
    if (location.state?.filterCategoryName && !location.state?.filterCategoryId) {
      const cat = (categories || []).find(c => String(c?.type?.name || '').toLowerCase() === 'expense' && c.name === location.state.filterCategoryName);
      if (cat?.id) setCategoryFilter(cat.id);
    }
  }, [location.state]);

  const expenseCategories = useMemo(() => {
    return (categories || []).filter((c) => String(c?.type?.name || '').toLowerCase() === 'expense');
  }, [categories]);

  // Period options
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || '').split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod]);
  const months = useMemo(() => buildFullYearMonths(selectedYear, locale), [selectedYear, locale]);
  const years = useMemo(() => buildAvailableYears(expenses || [], []), [expenses]);
  const periodOptions = periodType === 'month' ? months : years;

  // Filter by period first
  const periodExpenses = useMemo(() => {
    if (periodType === 'all') return expenses || [];
    if (periodType === 'month') return filterByMonth(expenses || [], [], selectedPeriod).periodExpenses;
    return filterByYear(expenses || [], [], Number(selectedPeriod)).periodExpenses;
  }, [expenses, periodType, selectedPeriod]);

  const filtered = useMemo(() => {
    return (periodExpenses || []).filter((r) => {
      const q = query.toLowerCase();
      const matchesQ = !q || String(r.notes || '').toLowerCase().includes(q);
      const matchesC = !categoryFilter || r.category?.id === categoryFilter;
      return matchesQ && matchesC;
    });
  }, [periodExpenses, query, categoryFilter]);

  const columns = [
    { key: 'date', header: t('date') },
    { key: 'categoryName', header: t('category') },
    { key: 'amount', header: t('amount') },
    { key: 'notes', header: t('notes') },
  ];

  const onSubmit = async (values) => {
    const payload = {
      categoryName: String(values.categoryName || '').trim().toLowerCase(),
      amount: Number(values.amount),
      currency: values.currency || 'ARS',
      date: values.date,
      notes: values.notes,
    };
    if (editingId) {
      await updateExpense(editingId, payload);
    } else {
      await addExpense(payload);
    }
    reset();
    setCatQuery('');
    setEditingId(null);
    setShowSuggestions(false);
    setShowForm(false);
  };

  const suggestions = useMemo(() => {
    const q = String(catQuery || '').toLowerCase();
    if (!q) return [];
    return expenseCategories
      .filter((c) => String(c.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [expenseCategories, catQuery]);

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setValue('date', today, { shouldDirty: true, shouldTouch: true });
  }

  function handleCategoryInput(e) {
    const lower = e.target.value.toLowerCase();
    setValue('categoryName', lower, { shouldDirty: true });
    setCatQuery(lower);
    setShowSuggestions(true);
  }

  function pickSuggestion(name) {
    const lower = String(name || '').toLowerCase();
    setValue('categoryName', lower, { shouldDirty: true, shouldTouch: true });
    setCatQuery(lower);
    setShowSuggestions(false);
  }

  function handleDelete(row) {
    if (!row?.id) return;
    removeExpense(row.id);
  }

  function handleEdit(row) {
    if (!row) return;
    setShowForm(true);
    setEditingId(row.id);
    const catName = (row.category?.name || row.categoryName || '').toLowerCase();
    setCatQuery(catName);
    setValue('categoryName', catName);
    setValue('amount', row.rawAmount ?? row.amount);
    setValue('currency', row.currency || 'ARS');
    setValue('date', (row.rawDate || row.date || '').slice(0, 10));
    setValue('notes', row.notes || '');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('expenseOverview')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('expenseOverviewSub')}</p>
        </div>
        <button onClick={() => { if (showForm) { setShowForm(false); } else { setShowForm(true); setEditingId(null); reset(); setCatQuery(''); } }} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{showForm ? 'Close' : t('addExpense')}</button>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('searchInNotes')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t('allOption')}</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm text-[#616f89] dark:text-gray-400">{t('period')}:</label>
            <select
              className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary"
              value={periodType}
              onChange={(e) => {
                const v = e.target.value;
                setPeriodType(v);
                if (v === 'month') setSelectedPeriod(getCurrentYearMonth());
                else if (v === 'year') setSelectedPeriod(String(new Date().getFullYear()));
              }}
            >
              <option value="all">{t('allOption')}</option>
              <option value="month">{t('periodMonth')}</option>
              <option value="year">{t('periodYear')}</option>
            </select>
            {periodType !== 'all' && (
              <select
                className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {showForm && (
        <Card title={editingId ? 'Edit Expense' : 'Create Expense'}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1 relative">
              <label className="text-sm text-[#616f89]">Category</label>
              <input {...register('categoryName', { required: true })} value={catQuery} onChange={handleCategoryInput} onFocus={() => setShowSuggestions(true)} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="e.g. groceries" />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow">
                  {suggestions.map((s) => (
                    <button type="button" key={s.id} onClick={() => pickSuggestion(s.name)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">Amount</label>
              <input type="number" step="0.01" {...register('amount', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">Currency</label>
              <select {...register('currency')} className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" defaultValue="ARS">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
                <option value="MXN">MXN</option>
                <option value="CLP">CLP</option>
                <option value="UYU">UYU</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">Date</label>
              <div className="flex items-center gap-2">
                <input type="date" {...register('date', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" />
                <button type="button" onClick={setToday} className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm">Today</button>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-sm text-[#616f89]">Notes</label>
              <input {...register('notes')} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="Optional note" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{editingId ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </Card>
      )}

      {filtered.length ? (
        <Table
          columns={columns}
          rows={filtered.map((r) => {
            const ym = extractYearMonth(r.date);
            const monthLabel = ym ? formatMonthYear(new Date(Date.UTC(ym.year, ym.month - 1, 15))) : formatDate(r.date);
            const categoryName = r.category?.name ?? '';
            return {
              id: r.id,
              date: (
                <button
                  type="button"
                  className="hover:underline hover:text-primary"
                  title={`${t('filterBy')} ${monthLabel}`}
                  onClick={() => {
                    setPeriodType('month');
                    if (ym) setSelectedPeriod(`${ym.year}-${String(ym.month).padStart(2, '0')}`);
                  }}
                >
                  {monthLabel}
                </button>
              ),
              categoryName: (
                <div className="flex items-center gap-2">
                  {categoryName ? (
                    <button
                      onClick={() => setCategoryFilter(categoryFilter === r.category?.id ? '' : (r.category?.id || ''))}
                      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 transition-all hover:scale-125 cursor-pointer ${categoryFilter === r.category?.id ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      style={{ backgroundColor: getCategoryColor(categoryName) }}
                      title={`${t('filterBy')} ${categoryName}`}
                    />
                  ) : (
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
                  )}
                  <span>{categoryName || '-'}</span>
                </div>
              ),
              amount: formatMoney(r.amount, r.currency || 'ARS'),
              notes: r.notes,
              currency: r.currency,
              category: r.category,
              rawAmount: r.amount,
              rawDate: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
            };
          })}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ) : (
        <Card>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noExpenses')}</p>
        </Card>
      )}
    </div>
  );
}

// Helpers from Spreadsheet.jsx (trimmed for expenses only)
function getCurrentYearMonth() {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' });
    const parts = formatter.formatToParts(now);
    const y = parts.find((p) => p.type === 'year');
    const m = parts.find((p) => p.type === 'month');
    if (y && m) return `${y.value}-${m.value}`;
  } catch {}
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function extractYearMonth(dateStr) {
  if (!dateStr) return null;
  let str = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr).trim();
  let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { year: Number(m[3]), month: Number(m[2]) };
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function buildFullYearMonths(year, locale) {
  const arr = [];
  for (let m = 1; m <= 12; m += 1) {
    const date = new Date(Date.UTC(year, m - 1, 15, 12, 0, 0));
    const raw = new Intl.DateTimeFormat(locale || 'es-AR', { month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(date);
    const three = raw.replace('.', '').slice(0, 3);
    const monthAbbr = three.charAt(0).toUpperCase() + three.slice(1);
    const label = `${monthAbbr} ${year}`;
    arr.push({ value: `${year}-${String(m).padStart(2, '0')}`, label });
  }
  return arr.sort((a, b) => (a.value < b.value ? 1 : -1));
}

function buildAvailableYears(expenses = []) {
  const set = new Set();
  const add = (ts) => {
    const ym = extractYearMonth(ts);
    if (ym) set.add(String(ym.year));
  };
  expenses.forEach((e) => add(e.date));
  if (set.size === 0) set.add(String(new Date().getFullYear()));
  const values = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  return values.map((v) => ({ value: v, label: v }));
}

function filterByMonth(expenses = [], _income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  return { periodExpenses: expenses.filter((e) => inMonth(e.date)) };
}

function filterByYear(expenses = [], _income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  return { periodExpenses: expenses.filter((e) => inYear(e.date)) };
}

function formatMonthYear(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value || '');
    const mf = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric' });
    const out = mf.format(d).replace('.', '');
    return out.charAt(0).toUpperCase() + out.slice(1);
  } catch {
    return String(value || '');
  }
}

function getCategoryColor(categoryName) {
  if (!categoryName) return '#9ca3af';
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const goldenAngle = 137.508;
  const hue = (Math.abs(hash) * goldenAngle) % 360;
  const saturation = 55 + (Math.abs(hash) % 35);
  const lightness = 45 + (Math.abs(hash >> 8) % 20);
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`;
}



