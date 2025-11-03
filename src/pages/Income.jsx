import React, { useMemo, useState } from 'react';
import Table from '../components/Table.jsx';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Income() {
  const { income, t } = useApp();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    return (income || []).filter((r) =>
      !query || String(r.source).toLowerCase().includes(query.toLowerCase())
    );
  }, [income, query]);

  const columns = [
    { key: 'source', header: 'Source/Origin' },
    { key: 'amount', header: 'Amount' },
    { key: 'date', header: 'Date' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('familyIncome')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('familyIncomeSub')}</p>
        </div>
        <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold">{t('addIncome')}</button>
      </div>

      <Card>
        <input className="form-input rounded-lg bg-gray-100 dark:bg-gray-800 border-none focus:ring-primary" placeholder="Search by source" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Card>

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



