import React, { useMemo, useState } from 'react';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useForm } from 'react-hook-form';
import { formatDate, formatMoney } from '../utils/format.js';

export default function Income() {
  const { income, t, addIncome, updateIncome, removeIncome, persons, categories } = useApp();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const [editingId, setEditingId] = useState(null);
  const [catQuery, setCatQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const incomeCategories = useMemo(() => {
    return (categories || []).filter((c) => String(c?.type?.name || '').toLowerCase() === 'income');
  }, [categories]);

  const rows = useMemo(() => {
    return (income || [])
      .filter((r) => !query || String(r.source || '').toLowerCase().includes(query.toLowerCase()))
      .map((r) => ({
        ...r,
        date: formatDate(r.date),
        rawAmount: r.amount,
        rawDate: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString(),
      }));
  }, [income, query]);

  const columns = [
    { key: 'categoryName', header: 'Category' },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
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
      currency: values.currency || 'USD',
      date: values.date,
      personId: values.personId,
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
    setValue('currency', row.currency || 'USD');
    setValue('date', (row.rawDate || row.date || '').slice(0, 10));
    setValue('personId', row.personId || '');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('familyIncome')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('familyIncomeSub')}</p>
        </div>
        <button onClick={() => { setShowForm((s) => !s); if (!showForm) { setEditingId(null); reset(); } }} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{showForm ? 'Close' : t('addIncome')}</button>
      </div>

      <Card>
        <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('searchBySource')} value={query} onChange={(e) => setQuery(e.target.value)} />
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
              <select {...register('currency')} className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
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
              <select {...register('personId', { required: true })} className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="">Select a person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
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
          rows={rows.map((r) => ({
            id: r.id,
            categoryName: r.category?.name ?? r.source ?? '',
            amount: formatMoney(r.rawAmount ?? r.amount, r.currency || 'USD'),
            date: r.date,
            currency: r.currency,
            person: r.person,
            personId: r.personId,
            category: r.category,
            source: r.source,
            rawAmount: r.rawAmount,
            rawDate: r.rawDate,
          }))}
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



