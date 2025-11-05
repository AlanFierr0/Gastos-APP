import React, { useMemo, useState, useEffect } from 'react';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useForm } from 'react-hook-form';
import { formatDate, formatMoney } from '../utils/format.js';
import { useLocation } from 'react-router-dom';

export default function Income() {
  const { income, t, addIncome, updateIncome, removeIncome, persons, categories, locale } = useApp();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [periodType, setPeriodType] = useState('all'); // all | month | year
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentYearMonth());
  const [showForm, setShowForm] = useState(location.state?.openForm || false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const [editingId, setEditingId] = useState(null);
  const [catQuery, setCatQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Clear navigation state after opening form
  useEffect(() => {
    if (location.state?.openForm) {
      // Clear the state to prevent reopening on back navigation
      window.history.replaceState({}, document.title);
    }
    // Apply incoming filters (from Dashboard)
    if (location.state?.filterPersonId) {
      setPersonFilter(location.state.filterPersonId);
    }
    if (location.state?.periodType) {
      setPeriodType(location.state.periodType);
    }
    if (location.state?.selectedPeriod) {
      setSelectedPeriod(location.state.selectedPeriod);
    }
  }, [location.state]);

  const incomeCategories = useMemo(() => {
    return (categories || []).filter((c) => String(c?.type?.name || '').toLowerCase() === 'income');
  }, [categories]);

  const personMap = useMemo(() => {
    const map = new Map();
    (persons || []).forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);

  // Period options
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || '').split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod]);
  const months = useMemo(() => buildFullYearMonths(selectedYear, locale), [selectedYear, locale]);
  const years = useMemo(() => buildAvailableYears([], income || []), [income]);
  const periodOptions = periodType === 'month' ? months : years;

  // Filter by period first
  const periodIncome = useMemo(() => {
    if (periodType === 'all') return income || [];
    if (periodType === 'month') return filterByMonth([], income || [], selectedPeriod).periodIncome;
    return filterByYear([], income || [], Number(selectedPeriod)).periodIncome;
  }, [income, periodType, selectedPeriod]);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return (periodIncome || [])
      .filter((r) => (!q || String(r.source || '').toLowerCase().includes(q))
        && (!categoryFilter || (r.category?.id === categoryFilter))
        && (!personFilter || r.personId === personFilter))
      .map((r) => ({
        ...r,
        date: formatDate(r.date),
        rawAmount: r.amount,
        rawDate: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
      }));
  }, [periodIncome, query, categoryFilter, personFilter]);

  const columns = [
    { key: 'date', header: t('date') },
    { key: 'categoryName', header: t('category') },
    { key: 'person', header: t('person') },
    { key: 'amount', header: t('amount') },
    { key: 'type', header: t('incomeType') },
  ];

  const suggestions = useMemo(() => {
    const q = String(catQuery || '').toLowerCase();
    if (!q) return [];
    return incomeCategories
      .filter((c) => String(c.name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [incomeCategories, catQuery]);

  const onSubmit = async (values) => {
    const payload = {
      source: String(values.source || '').trim().toLowerCase(),
      categoryName: String(values.categoryName || '').trim().toLowerCase(),
      amount: Number(values.amount),
      currency: values.currency || 'ARS',
      date: values.date,
      personId: values.personId,
      isRecurring: values.isRecurring === true || values.isRecurring === 'true',
    };
    if (editingId) {
      await updateIncome(editingId, payload);
    } else {
      await addIncome(payload);
    }
    reset();
    setCatQuery('');
    setEditingId(null);
    setShowSuggestions(false);
    setShowForm(false);
  };

  function handleCategoryInput(e) {
    const lower = e.target.value.toLowerCase();
    setValue('categoryName', lower, { shouldDirty: true });
    setValue('source', lower);
    setCatQuery(lower);
    setShowSuggestions(true);
  }

  function pickSuggestion(name) {
    const lower = String(name || '').toLowerCase();
    setValue('categoryName', lower, { shouldDirty: true, shouldTouch: true });
    setValue('source', lower);
    setCatQuery(lower);
    setShowSuggestions(false);
  }

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setValue('date', today, { shouldDirty: true, shouldTouch: true });
  }

  function handleDelete(row) {
    if (!row?.id) return;
    removeIncome(row.id);
  }

  function handleEdit(row) {
    if (!row) return;
    setShowForm(true);
    setEditingId(row.id);
    const catName = (row.category?.name || row.source || '').toLowerCase();
    setCatQuery(catName);
    setValue('categoryName', catName);
    setValue('source', catName);
    setValue('amount', row.rawAmount ?? row.amount);
    setValue('currency', row.currency || 'ARS');
    setValue('date', (row.rawDate || row.date || '').slice(0, 10));
    setValue('personId', row.personId || '');
    setValue('isRecurring', row.isRecurring ? 'true' : 'false');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('familyIncome')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('familyIncomeSub')}</p>
        </div>
        <button onClick={() => { if (showForm) { setShowForm(false); } else { setShowForm(true); setEditingId(null); reset(); } }} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{showForm ? 'Close' : t('addIncome')}</button>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('searchBySource')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t('allOption')}</option>
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">{t('allOption')}</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
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
        <Card title={editingId ? 'Edit Income' : 'Create Income'}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1 relative">
              <label className="text-sm text-[#616f89]">Category</label>
              <input {...register('categoryName', { required: true })} value={catQuery} onChange={handleCategoryInput} onFocus={() => setShowSuggestions(true)} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="e.g. salary" />
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
              <label className="text-sm text-[#616f89]">Person</label>
              <select {...register('personId', { required: true })} className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="">Select a person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-sm text-[#616f89]">{t('incomeType')}</label>
              <select {...register('isRecurring')} className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="false">{t('extraordinaryIncome')}</option>
                <option value="true">{t('recurringIncome')}</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{editingId ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </Card>
      )}

      {rows.length ? (
        <Table
          columns={columns}
          rows={rows.map((r) => {
            const ym = extractYearMonth(r.date);
            const monthLabel = ym ? formatMonthYear(new Date(Date.UTC(ym.year, ym.month - 1, 15))) : formatDate(r.date);
            const personObj = personMap.get(r.personId);
            const personColor = personObj?.color || '#3b82f6';
            const personIcon = personObj?.icon || 'person';
            const categoryName = r.category?.name ?? r.source ?? '';
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
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoryColor(categoryName) }}
                    />
                  ) : (
                    <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
                  )}
                  <span>{categoryName || '-'}</span>
                </div>
              ),
              person: (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPersonFilter(personFilter === r.personId ? '' : (r.personId || ''))}
                    className={`material-symbols-outlined text-lg transition-all hover:scale-110 cursor-pointer ${personFilter === r.personId ? 'ring-2 ring-primary ring-offset-1 rounded' : ''}`}
                    style={{ color: personColor }}
                    title={`${t('filterBy')} ${r.person?.name || ''}`}
                  >
                    {personIcon}
                  </button>
                  <span>{r.person?.name || '-'}</span>
                </div>
              ),
              amount: formatMoney(r.rawAmount ?? r.amount, r.currency || 'ARS'),
              type: r.isRecurring ? t('recurringIncome') : t('extraordinaryIncome'),
              currency: r.currency,
              personId: r.personId,
              category: r.category,
              source: r.source,
              rawAmount: r.rawAmount,
              rawDate: r.rawDate,
              isRecurring: r.isRecurring,
            };
          })}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ) : (
        <Card>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noIncome')}</p>
        </Card>
      )}
    </div>
  );
}

// Helpers (subset from Spreadsheet.jsx)
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

function buildAvailableYears(_expenses = [], income = []) {
  const set = new Set();
  const add = (ts) => {
    const ym = extractYearMonth(ts);
    if (ym) set.add(String(ym.year));
  };
  income.forEach((i) => add(i.date));
  if (set.size === 0) set.add(String(new Date().getFullYear()));
  const values = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  return values.map((v) => ({ value: v, label: v }));
}

function filterByMonth(_expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  return { periodIncome: income.filter((i) => inMonth(i.date)) };
}

function filterByYear(_expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  return { periodIncome: income.filter((i) => inYear(i.date)) };
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



