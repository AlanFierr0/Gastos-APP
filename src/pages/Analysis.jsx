import React from 'react';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Analysis() {
  const { t } = useApp();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">{t('analysisTitle')}</p>
        <p className="text-[#616f89] dark:text-gray-400">{t('analysisSubtitle')}</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('incomeVsExpenses6m')} className="lg:col-span-2">
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
        </Card>
        <Card title={t('expenseBreakdown')}>
          <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
        </Card>
      </section>
    </div>
  );
}


