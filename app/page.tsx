'use client';

import { useGastos } from '@/hooks/useGastos';
import StatsCards from '@/components/StatsCards';
import DataTable from '@/components/DataTable';

export default function DashboardPage() {
  const { gastos, loading, error } = useGastos();

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Vista general de todos tus gastos registrados
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mt-8">
        <StatsCards gastos={gastos} />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Últimos Gastos</h2>
        <DataTable gastos={gastos} loading={loading} />
      </div>
    </div>
  );
}
