import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney } from '../utils/format.js';

export default function People() {
  const { persons, addPerson, updatePerson, removePerson, income, expenses, t } = useApp();
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');

  const totalsByPerson = useMemo(() => computeTotalsByPerson(persons, income, expenses), [persons, income, expenses]);

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

      <section className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 bg-white dark:bg-gray-900/50">
        <div className="flow-root">
          <ul className="divide-y divide-gray-200 dark:divide-gray-800" role="list">
            {persons.map((p) => (
              <li key={p.id} className="py-3 sm:py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">person</span>
                    <InlineEditableName name={p.name} onChange={(newName) => updatePerson(p.id, newName)} />
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('incomeTotal')}:</span>{' '}
                      <strong className="text-green-600">{formatMoney(totalsByPerson[p.id]?.income || 0, 'USD')}</strong>
                    </div>
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('expenseTotal')}:</span>{' '}
                      <strong className="text-red-500">{formatMoney(totalsByPerson[p.id]?.expenses || 0, 'USD')}</strong>
                    </div>
                    <div>
                      <span className="text-[#616f89] dark:text-gray-400">{t('netTotal')}:</span>{' '}
                      <strong>{formatMoney((totalsByPerson[p.id]?.income || 0) - (totalsByPerson[p.id]?.expenses || 0), 'USD')}</strong>
                    </div>
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

function InlineEditableName({ name, onChange }) {
  const { t } = useApp();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  function save() {
    onChange(value);
    setEditing(false);
  }
  return (
    <div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 px-2 rounded-md bg-gray-100 dark:bg-gray-800 text-sm"
          />
          <button onClick={save} className="h-8 px-2 rounded-md bg-primary text-white text-sm">{t('edit')}</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm font-medium truncate">{name}</button>
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


