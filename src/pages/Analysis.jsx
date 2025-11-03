import React from 'react';
import Card from '../components/Card.jsx';
import { BarCompare, PieBreakdown } from '../components/Chart.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Analysis() {
  const { expenses, income } = useApp();
  const monthly = [];
  const categories = [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">Financial Analysis</p>
        <p className="text-[#616f89] dark:text-gray-400">Comparatives by month and category.</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Income vs. Expenses (last 6 months)" className="lg:col-span-2">
          {monthly.length ? (
            <BarCompare data={monthly} />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">No data yet.</p>
          )}
        </Card>
        <Card title="Expense Breakdown">
          {categories.length ? (
            <PieBreakdown data={categories} />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">No data yet.</p>
          )}
        </Card>
      </section>
    </div>
  );
}


