import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatDate, formatMoney } from '../utils/format.js';
import ExchangeRates from '../components/ExchangeRates.jsx';

export default function Investments() {
  const { investments, addInvestment, updateInvestment, removeInvestment, t, investmentSummary } = useApp();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('');

  const investmentTypes = [
    { value: 'bitcoin', label: 'Bitcoin' },
    { value: 'fci', label: t('fci') },
    { value: 'acciones', label: t('stocks') },
    { value: 'bonos', label: t('bonds') },
    { value: 'plazo_fijo', label: t('fixedTerm') },
    { value: 'otros', label: t('other') },
  ];

  const filtered = useMemo(() => {
    return (investments || []).filter((inv) => (!filterType || inv.type === filterType));
  }, [investments, filterType]);

  const columns = [
    { key: 'type', header: t('type') },
    { key: 'name', header: t('name') },
    { key: 'amount', header: t('invested') },
    { key: 'value', header: t('currentValue') },
    { key: 'profit', header: t('profit') },
    { key: 'date', header: t('date') },
  ];

  const onSubmit = async (values) => {
    const payload = {
      type: values.type,
      name: values.name,
      amount: Number(values.amount),
      value: Number(values.value),
      currency: values.currency || 'ARS',
      date: values.date,
      notes: values.notes || undefined,
    };
    if (editingId) {
      await updateInvestment(editingId, payload);
    } else {
      await addInvestment(payload);
    }
    reset();
    setEditingId(null);
    setShowForm(false);
  };

  function setToday() {
    const today = new Date().toISOString().slice(0, 10);
    setValue('date', today, { shouldDirty: true, shouldTouch: true });
  }

  function handleDelete(row) {
    if (!row?.id) return;
    removeInvestment(row.id);
  }

  function handleEdit(row) {
    if (!row) return;
    setShowForm(true);
    setEditingId(row.id);
    setValue('type', row.type);
    setValue('name', row.name);
    setValue('amount', row.amount);
    setValue('value', row.value);
    setValue('currency', row.currency || 'ARS');
    setValue('date', (typeof row.date === 'string' ? row.date : new Date(row.date).toISOString()).slice(0, 10));
    setValue('notes', row.notes || '');
  }

  const rows = filtered.map((inv) => {
    const profit = Number(inv.value || 0) - Number(inv.amount || 0);
    const profitPercent = Number(inv.amount || 0) > 0 
      ? ((profit / Number(inv.amount || 0)) * 100).toFixed(2) 
      : '0.00';
    
    return {
      id: inv.id,
      type: investmentTypes.find(t => t.value === inv.type)?.label || inv.type,
      name: inv.name,
      amount: formatMoney(inv.amount, inv.currency || 'ARS'),
      value: formatMoney(inv.value, inv.currency || 'ARS'),
      profit: (
        <span className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>
          {formatMoney(profit, inv.currency || 'ARS')} ({profitPercent}%)
        </span>
      ),
      date: formatDate(inv.date),
      currency: inv.currency,
      notes: inv.notes,
      rawAmount: inv.amount,
      rawValue: inv.value,
      rawDate: typeof inv.date === 'string' ? inv.date : new Date(inv.date).toISOString(),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('investments')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('investmentsSubtitle')}</p>
        </div>
        <button 
          onClick={() => { 
            setShowForm((s) => !s); 
            if (!showForm) { 
              setEditingId(null); 
              reset(); 
            } 
          }} 
          className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold"
        >
          {showForm ? t('close') : t('addInvestment')}
        </button>
      </div>

      <ExchangeRates />

      {investmentSummary && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title={t('totalInvested')}>
            <p className="text-3xl font-bold">
              {formatMoney(investmentSummary.totalInvested || 0, 'ARS', { sign: 'none' })}
            </p>
          </Card>
          <Card title={t('totalValue')}>
            <p className="text-3xl font-bold">
              {formatMoney(investmentSummary.totalValue || 0, 'ARS', { sign: 'none' })}
            </p>
          </Card>
          <Card title={t('totalProfit')}>
            <p className={`text-3xl font-bold ${(investmentSummary.profit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatMoney(investmentSummary.profit || 0, 'ARS')}
            </p>
          </Card>
        </section>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-[#616f89] dark:text-gray-400">{t('type')}:</label>
          <select
            className="form-select rounded-xl bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">{t('allOption')}</option>
            {investmentTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {showForm && (
        <Card title={editingId ? t('editInvestment') : t('createInvestment')}>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('type')}</label>
              <select {...register('type', { required: true })} className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary">
                {investmentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('name')}</label>
              <input {...register('name', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('investmentNamePlaceholder')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('invested')}</label>
              <input type="number" step="0.01" {...register('amount', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('currentValue')}</label>
              <input type="number" step="0.01" {...register('value', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" placeholder="0.00" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('currency')}</label>
              <select {...register('currency')} className="form-select rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" defaultValue="ARS">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[#616f89]">{t('date')}</label>
              <div className="flex items-center gap-2">
                <input type="date" {...register('date', { required: true })} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" />
                <button type="button" onClick={setToday} className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm">Today</button>
              </div>
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-sm text-[#616f89]">{t('notes')}</label>
              <input {...register('notes')} className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder={t('optionalNotes')} />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{editingId ? t('update') : t('save')}</button>
            </div>
          </form>
        </Card>
      )}

      {rows.length ? (
        <Table
          columns={columns}
          rows={rows}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ) : (
        <Card>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noInvestments')}</p>
        </Card>
      )}
    </div>
  );
}

