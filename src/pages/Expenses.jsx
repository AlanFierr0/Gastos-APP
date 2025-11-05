import React, { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { formatMoney } from '../utils/format.js';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatDate } from '../utils/format.js';
import { useLocation } from 'react-router-dom';

export default function Expenses() {
  const { expenses, addExpense, updateExpense, removeExpense, t, persons, categories } = useApp();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
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
  }, [location.state]);

  const expenseCategories = useMemo(() => {
    return (categories || []).filter((c) => String(c?.type?.name || '').toLowerCase() === 'expense');
  }, [categories]);

  const filtered = useMemo(() => {
    return (expenses || []).filter((r) => {
      const q = query.toLowerCase();
      const matchesQ = !q || String(r.notes || '').toLowerCase().includes(q);
      const matchesC = !categoryFilter || r.category?.id === categoryFilter;
      return matchesQ && matchesC;
    });
  }, [expenses, query, categoryFilter]);

  const columns = [
    { key: 'categoryName', header: 'Category' },
    { key: 'person', header: t('person') },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
    { key: 'notes', header: 'Notes' },
  ];

  const onSubmit = async (values) => {
    const payload = {
      categoryName: String(values.categoryName || '').trim().toLowerCase(),
      amount: Number(values.amount),
      currency: values.currency || 'ARS',
      date: values.date,
      notes: values.notes,
      personId: values.personId,
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
    setValue('personId', row.person?.id || row.personId || '');
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
        <div className="flex flex-col md:flex-row gap-3">
          <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('searchInNotes')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t('allOption')}</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
              <label className="text-sm text-[#616f89]">Person</label>
              <select {...register('personId', { required: true })} className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="">Select a person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
          rows={filtered.map((r) => ({
            id: r.id,
            categoryName: r.category?.name ?? '',
            person: r.person?.name || '',
            amount: formatMoney(r.amount, r.currency || 'ARS'),
            date: formatDate(r.date),
            notes: r.notes,
            currency: r.currency,
            personId: r.personId,
            category: r.category,
            rawAmount: r.amount,
            rawDate: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
          }))}
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



