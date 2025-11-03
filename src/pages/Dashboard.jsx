import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { LineSeries, PieBreakdown } from '../components/Chart.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';

export default function Dashboard() {
  const { totals, expenses, income, t, locale, addExpense, addIncome } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentYearMonth());

  const months = useMemo(() => buildAvailableMonths(expenses, income, locale), [expenses, income, locale]);

  // Ensure selected month is valid even when data changes
  const effectiveMonth = months.length ? (months.some((m) => m.value === selectedMonth) ? selectedMonth : months[0].value) : getCurrentYearMonth();

  const { monthExpenses, monthIncome } = useMemo(() => filterByMonth(expenses, income, effectiveMonth), [expenses, income, effectiveMonth]);
  const monthTotals = useMemo(() => computeTotals(monthExpenses, monthIncome), [monthExpenses, monthIncome]);

  function handleAddIncome() {
    const base = handlePrompt({ amount: '', date: '' });
    if (!base) return;
    const source = window.prompt('Source', '') || '';
    const person = window.prompt('Person (name)', '') || '';
    const currency = 'USD';
    addIncome({ amount: base.amount, date: base.date, source, person, currency });
  }

  function handleAddExpense() {
    const base = handlePrompt({ amount: '', date: '' });
    if (!base) return;
    const category = window.prompt('Category', '') || '';
    const notes = window.prompt('Notes', '') || '';
    const person = window.prompt('Person (name)', '') || '';
    const currency = 'USD';
    addExpense({ amount: base.amount, date: base.date, category, notes, person, currency });
  }

  // Use live data only: aggregate minimally when available, otherwise charts will be empty
  const lineData = [];
  const pieData = [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('monthlyOverview')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('monthlyOverviewSub')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddIncome}
            className="h-9 px-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            {t('addIncome')}
          </button>
          <button
            onClick={handleAddExpense}
            className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            {t('addExpense')}
          </button>
          <select
            id="month-select"
            className="h-9 px-3 pr-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm appearance-none"
            value={effectiveMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('totalIncome')}>
          <p className="text-3xl font-bold">${monthTotals.totalIncome.toFixed(2)}</p>
        </Card>
        <Card title={t('totalExpenses')}>
          <p className="text-3xl font-bold">${monthTotals.totalExpenses.toFixed(2)}</p>
        </Card>
        <Card title={t('netBalance')}>
          <p className="text-3xl font-bold">${monthTotals.balance.toFixed(2)}</p>
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('incomeVsExpenses')} className="lg:col-span-2">
          {lineData.length ? (
            <LineSeries data={lineData} />
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
            {getRecentTransactions(monthIncome, monthExpenses, t).map((t) => (
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
            {getRecentTransactions(monthIncome, monthExpenses, t).length === 0 && (
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
    category: e.category || t('expenseGeneric'),
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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function buildAvailableMonths(expenses = [], income = [], locale = undefined) {
  const set = new Set();
  const add = (ts) => {
    if (!ts) return;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    set.add(`${y}-${m}`);
  };
  income.forEach((i) => add(i.date));
  expenses.forEach((e) => add(e.date));
  const values = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  const formatter = (ym) => {
    const [y, m] = ym.split('-').map((v) => Number(v));
    const monthName = new Date(y, m - 1, 1).toLocaleString(locale || undefined, { month: 'long' });
    return `${monthName} ${y}`;
  };
  return values.length
    ? values.map((v) => ({ value: v, label: formatter(v) }))
    : [{ value: getCurrentYearMonth(), label: formatter(getCurrentYearMonth()) }];
}

function filterByMonth(expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    if (!ts) return false;
    const d = new Date(ts);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  };
  const monthIncome = income.filter((i) => inMonth(i.date));
  const monthExpenses = expenses.filter((e) => inMonth(e.date));
  return { monthIncome, monthExpenses };
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

function parseNumber(input) {
  const num = Number(String(input || '').toString().replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

function handlePrompt(defaults) {
  const amountStr = window.prompt('Amount', defaults.amount ?? '');
  if (amountStr == null) return null;
  const amount = parseNumber(amountStr);
  const dateStr = window.prompt('Date (YYYY-MM-DD)', defaults.date ?? new Date().toISOString().slice(0, 10));
  if (dateStr == null) return null;
  const date = new Date(dateStr).toISOString();
  return { amount, date };
}



