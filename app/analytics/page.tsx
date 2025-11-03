'use client';

import { useGastos } from '@/hooks/useGastos';
import Charts from '@/components/Charts';
import StatsCards from '@/components/StatsCards';

export default function AnalyticsPage() {
  const { gastos, loading, error } = useGastos();

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-2 text-sm text-gray-700">
            Análisis detallado y visualización de tus gastos
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-8 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <StatsCards gastos={gastos} />
          </div>

          <div className="mt-8">
            <Charts gastos={gastos} />
          </div>
        </>
      )}
    </div>
  );
}
