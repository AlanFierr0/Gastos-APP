import React, { useMemo, useState } from 'react';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useForm } from 'react-hook-form';

export default function Income() {
  const { income, t, addIncome, persons } = useApp();
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const rows = useMemo(() => {
    return (income || []).filter((r) =>
      !query || String(r.source || '').toLowerCase().includes(query.toLowerCase())
    );
  }, [income, query]);

  const columns = [
    { key: 'source', header: 'Source/Origin' },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
  ];

  const onSubmit = async (values) => {
    await addIncome({
      source: values.source,
      amount: Number(values.amount),
      currency: values.currency || 'USD',
      date: values.date,
      personId: values.personId,
    });
    reset();
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('familyIncome')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('familyIncomeSub')}</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{showForm ? 'Close' : t('addIncome')}</button>
      </div>

      <Card>
        <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('searchBySource')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>

      {showForm && (
        <Card title="Create Income">
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">Source</label>
              <input {...register('source', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="e.g. Salary" />
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
              <label className="text-sm text-[#616f89]">Person</label>
              <select {...register('personId', { required: true })} className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                <option value="">Select a person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">Save</button>
            </div>
          </form>
        </Card>
      )}

      {rows.length ? (
        <Table columns={columns} rows={rows} />
      ) : (
        <Card>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noIncome')}</p>
        </Card>
      )}
    </div>
  );
}



