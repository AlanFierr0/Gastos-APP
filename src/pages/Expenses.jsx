import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatMoney } from '../utils/format.js';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Expenses() {
  const { expenses, addExpense, t } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const filtered = useMemo(() => {
    return (expenses || []).filter((r) => {
      const q = query.toLowerCase();
      const matchesQ = !q || String(r.notes || '').toLowerCase().includes(q);
      const matchesC = !category || r.category === category;
      return matchesQ && matchesC;
    });
  }, [expenses, query, category]);

  const columns = [
    { key: 'category', header: 'Category' },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
    { key: 'notes', header: 'Notes' },
  ];

  const categories = useMemo(() => {
    return Array.from(new Set((expenses || []).map((e) => e.category).filter(Boolean)));
  }, [expenses]);

  const onSubmit = async (values) => {
    await addExpense({
      category: values.category,
      amount: Number(values.amount),
      currency: values.currency || 'USD',
      date: values.date,
      notes: values.notes,
    });
    reset();
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('expenseOverview')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('expenseOverviewSub')}</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{showForm ? 'Close' : t('addExpense')}</button>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-3">
          <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="Search in notes" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </Card>

      {showForm && (
        <Card title="Create Expense">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">Category</label>
              <input {...register('category', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="e.g. Groceries" />
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
              <input type="date" {...register('date', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" />
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-sm text-[#616f89]">Notes</label>
              <input {...register('notes')} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="Optional note" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">Save</button>
            </div>
          </form>
        </Card>
      )}

      {filtered.length ? (
        <Table
          columns={columns}
          rows={filtered.map((r) => ({
            ...r,
            amount: formatMoney(r.amount, r.currency || 'USD'),
          }))}
        />
      ) : (
        <Card>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noExpenses')}</p>
        </Card>
      )}
    </div>
  );
}



