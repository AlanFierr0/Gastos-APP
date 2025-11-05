import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';
import Card from '../components/Card.jsx';
import { PieBreakdown, BarCompare } from '../components/Chart.jsx';
import { useNavigate } from 'react-router-dom';

export default function People() {
  const { persons, addPerson, updatePerson, removePerson, income, expenses, t, locale } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [periodType, setPeriodType] = useState('month');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentYearMonth());
  
  const currentMonth = getCurrentYearMonth();

  const totalsByPerson = useMemo(() => computeTotalsByPerson(persons, income, expenses), [persons, income, expenses]);
  
  // Determine selected year for month mode
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || currentMonth).split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod, currentMonth]);

  // Build 12 months for the selected year
  const months = useMemo(() => buildFullYearMonths(selectedYear, locale), [selectedYear, locale]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;

  // Ensure a valid month when switching to month mode
  React.useEffect(() => {
    if (periodType !== 'month') return;
    const isValid = Array.isArray(periodOptions) && periodOptions.some((p) => p.value === selectedPeriod);
    if (!isValid) setSelectedPeriod(currentMonth);
  }, [periodType, periodOptions, selectedPeriod, currentMonth]);

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

  // Filter data by period and person
  const { periodExpenses, periodIncome } = useMemo(() => {
    const filtered = periodType === 'month'
      ? filterByMonth(expenses, income, effectivePeriod)
      : filterByYear(expenses, income, Number(effectivePeriod));
    
    // Filter by selected person
    if (selectedPersonId) {
      const personIdStr = String(selectedPersonId);
      return {
        periodExpenses: filtered.periodExpenses.filter((e) => String(e.personId || '') === personIdStr),
        periodIncome: filtered.periodIncome.filter((i) => String(i.personId || '') === personIdStr),
      };
    }
    return filtered;
  }, [expenses, income, periodType, effectivePeriod, selectedPersonId]);

  // Calculate totals for selected person and period
  const personTotals = useMemo(() => computeTotals(periodExpenses, periodIncome), [periodExpenses, periodIncome]);

  // Pie chart data for expenses by category
  const pieData = useMemo(() => {
    const map = new Map();
    for (const e of periodExpenses) {
      const name = (typeof e.category === 'object' && e.category) ? (e.category.name || t('expenseGeneric')) : (e.category || t('expenseGeneric'));
      const prev = map.get(name) || 0;
      map.set(name, prev + Number(e.amount || 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [periodExpenses, t]);

  // Bar chart data
  const barData = useMemo(() => {
    const label = (periodOptions.find((p) => p.value === effectivePeriod)?.label) || effectivePeriod;
    return [{ name: label, income: Number(personTotals.totalIncome || 0), expenses: Number(personTotals.totalExpenses || 0) }];
  }, [periodOptions, effectivePeriod, personTotals]);

  // Set first person as selected by default
  React.useEffect(() => {
    if (!selectedPersonId && persons.length > 0) {
      setSelectedPersonId(persons[0].id);
    }
  }, [persons.length]); // Only depend on persons.length to avoid resetting selection

  // Debug: log when selectedPersonId changes
  React.useEffect(() => {
    
  }, [selectedPersonId]);

  function onAddPerson(e) {
    e.preventDefault();
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      setFormError(t('name'));
      return;
    }
    const exists = persons.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setFormError('Already exists');
      return;
    }
    addPerson(trimmed);
    setName('');
    setFormError('');
  }

  const isDisabled = !String(name || '').trim();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('people')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('peopleSubtitle')}</p>
        </div>
        <form onSubmit={onAddPerson} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError(''); }}
            placeholder={t('name')}
            className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm"
          />
          <button type="submit" disabled={isDisabled} className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t('addPerson')}</button>
        </form>
      </header>

      {formError && (
        <div className="text-sm text-red-500">{formError}</div>
      )}

      {/* Person selector and period controls */}
      {persons.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 px-3 pr-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm appearance-none"
            value={selectedPersonId || ''}
            onChange={(e) => {
              
              setSelectedPersonId(e.target.value);
            }}
          >
            {persons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
            className="h-9 px-3 pr-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm appearance-none"
            value={effectivePeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {periodOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Charts section for selected person */}
      {selectedPersonId && persons.some((p) => String(p.id) === String(selectedPersonId)) && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title={t('totalIncome')}>
              <p className="text-3xl font-bold">{formatMoney(personTotals.totalIncome, 'ARS', { sign: 'none' })}</p>
            </Card>
            <Card title={t('totalExpenses')}>
              <p className="text-3xl font-bold">{formatMoney(personTotals.totalExpenses, 'ARS', { sign: 'none' })}</p>
            </Card>
            <Card title={t('netBalance')}>
              <p className="text-3xl font-bold">{formatMoney(personTotals.balance, 'ARS', { sign: 'none' })}</p>
            </Card>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title={t('incomeVsExpenses')} className="lg:col-span-2">
              {barData.length && (barData[0].income > 0 || barData[0].expenses > 0) ? (
                <BarCompare 
                  data={barData} 
                  onIncomeClick={() => navigate('/income', { state: { periodType, selectedPeriod: effectivePeriod, filterPersonId: selectedPersonId } })}
                  onExpensesClick={() => navigate('/expenses', { state: { periodType, selectedPeriod: effectivePeriod, filterPersonId: selectedPersonId } })}
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
                    navigate('/expenses', { state: { filterPersonId: selectedPersonId, periodType, selectedPeriod, filterCategoryName: categoryName } });
                  }}
                />
              ) : (
                <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
              )}
            </Card>
          </section>
        </>
      )}

      {/* People list */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900/50">
        <div className="flow-root">
          <ul className="divide-y divide-gray-200 dark:divide-gray-800" role="list">
            {persons.map((p) => (
              <li key={p.id} className="py-3 sm:py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <InlineEditableName 
                      name={p.name} 
                      icon={p.icon || 'person'}
                      color={p.color}
                      onChange={(newName, newIcon, newColor) => updatePerson(p.id, newName, newIcon, newColor)} 
                    />
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('incomeTotal')}:</span>{' '}
                      <strong className="text-green-600">{formatMoney(totalsByPerson[p.id]?.income || 0, 'ARS')}</strong>
                    </div>
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('expenseTotal')}:</span>{' '}
                      <strong className="text-red-500">{formatMoney(totalsByPerson[p.id]?.expenses || 0, 'ARS')}</strong>
                    </div>
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('netTotal')}:</span>{' '}
                      <strong>{formatMoney((totalsByPerson[p.id]?.income || 0) - (totalsByPerson[p.id]?.expenses || 0), 'ARS')}</strong>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const personId = p.id;
                        
                        setSelectedPersonId(personId);
                        // Scroll to top after a short delay to allow state update
                        setTimeout(() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 100);
                      }} 
                      className="h-8 px-2 rounded-md bg-primary/10 text-primary dark:bg-primary/20 text-sm font-medium hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors cursor-pointer"
                    >
                      {t('viewDetails')}
                    </button>
                    <button onClick={() => removePerson(p.id)} className="h-8 px-2 rounded-md bg-gray-100 dark:bg-gray-800">{t('delete')}</button>
                  </div>
                </div>
              </li>
            ))}
            {persons.length === 0 && (
              <li className="py-2 text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function InlineEditableName({ name, icon, color, onChange }) {
  const { t } = useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [selectedIcon, setSelectedIcon] = useState(icon || 'person');
  const [selectedColor, setSelectedColor] = useState(color || null);
  
  // Update selectedIcon and selectedColor when props change
  React.useEffect(() => {
    setSelectedIcon(icon || 'person');
    // Only update color if a new color is provided, otherwise keep current selection
    if (color !== undefined) {
      setSelectedColor(color || null);
    }
  }, [icon, color]);
  
  // Iconos estilo Monopoly y representativos
  const iconOptions = [
    'man',           // Hombre
    'woman',         // Mujer
    'elderly',       // Abuelo/Abuela
    'child_care',    // Niño
    'family_restroom', // Familia
    'pets',          // Mascota
    'face',          // Persona genérica
    'groups',        // Grupo
    'star',          // Estrella (creativo)
    'diamond'        // Diamante (creativo)
  ];
  
  // Predefined color palette
  const colorOptions = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Orange
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange-red
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#22c55e', // Emerald
    '#a855f7', // Violet
    '#0ea5e9', // Sky
    '#eab308', // Yellow
  ];
  
  function save() {
    // Use selectedColor if set, otherwise use default
    const colorToSave = selectedColor || '#3b82f6';
    onChange(value, selectedIcon, colorToSave);
    setEditing(false);
  }
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 text-sm font-medium truncate hover:opacity-80"
      >
        <span className="material-symbols-outlined flex-shrink-0" style={{ color: selectedColor || color || '#3b82f6' }}>
          {selectedIcon}
        </span>
        <span>{name}</span>
      </button>
      {editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div 
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 shadow-xl z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">{t('editPerson')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#616f89] dark:text-gray-400 mb-2">{t('name')}</label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-2 focus:ring-primary text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-[#616f89] dark:text-gray-400 mb-2">{t('icon')}</label>
                <div className="grid grid-cols-5 gap-2">
                  {iconOptions.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        selectedIcon === iconName
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl" style={{ color: selectedColor || '#3b82f6' }}>
                        {iconName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-[#616f89] dark:text-gray-400 mb-2">{t('color')}</label>
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {colorOptions.map((colorValue) => (
                    <button
                      key={colorValue}
                      type="button"
                      onClick={() => setSelectedColor(colorValue)}
                      className={`w-10 h-10 rounded-xl border-2 transition-all ${
                        (selectedColor || '#3b82f6') === colorValue
                          ? 'border-gray-900 dark:border-gray-100 scale-110 ring-2 ring-primary ring-offset-2 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:scale-105 hover:shadow-sm'
                      }`}
                      style={{ backgroundColor: colorValue }}
                      title={colorValue}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={selectedColor || '#3b82f6'}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="h-10 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('close')}
                </button>
                <button
                  onClick={save}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeTotalsByPerson(persons = [], income = [], expenses = []) {
  const idByName = new Map(persons.map((p) => [p.name, p.id]));
  const totals = {};
  for (const p of persons) totals[p.id] = { income: 0, expenses: 0 };
  for (const i of income) {
    const pid = i.personId || idByName.get(i.person) || null;
    if (!pid) continue;
    totals[pid] = totals[pid] || { income: 0, expenses: 0 };
    totals[pid].income += Number(i.amount || 0);
  }
  for (const e of expenses) {
    const pid = e.personId || idByName.get(e.person) || null;
    if (!pid) continue;
    totals[pid] = totals[pid] || { income: 0, expenses: 0 };
    totals[pid].expenses += Number(e.amount || 0);
  }
  return totals;
}

// Reuse functions from Dashboard
function getCurrentYearMonth() {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const yearPart = parts.find((p) => p.type === 'year');
    const monthPart = parts.find((p) => p.type === 'month');
    if (yearPart && monthPart) {
      return `${yearPart.value}-${monthPart.value}`;
    }
  } catch (e) {
    
  }
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function extractYearMonth(dateStr) {
  if (!dateStr) return null;
  let str = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr).trim();
  let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month >= 1 && month <= 12) return { year, month };
  }
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
  const periodExpenses = expenses.filter((e) => inMonth(e.date));
  const periodIncome = income.filter((i) => {
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      return (incomeYm.year < y) || (incomeYm.year === y && incomeYm.month <= m);
    }
    return inMonth(i.date);
  });
  return { periodIncome, periodExpenses };
}

function filterByYear(expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  const periodExpenses = expenses.filter((e) => inYear(e.date));
  const periodIncome = income.filter((i) => {
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      return incomeYm.year <= year;
    }
    return inYear(i.date);
  });
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


