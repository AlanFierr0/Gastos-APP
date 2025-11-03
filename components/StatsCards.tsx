'use client';

import { useMemo } from 'react';
import { Gasto } from '@/types';

interface StatsCardsProps {
  gastos: Gasto[];
}

export default function StatsCards({ gastos }: StatsCardsProps) {
  const stats = useMemo(() => {
    const total = gastos.reduce((sum, gasto) => sum + gasto.monto, 0);
    const promedio = gastos.length > 0 ? total / gastos.length : 0;
    
    const porCategoria: { [key: string]: number } = {};
    gastos.forEach((gasto) => {
      porCategoria[gasto.categoria] = (porCategoria[gasto.categoria] || 0) + gasto.monto;
    });

    const categoriaMax = Object.entries(porCategoria).sort(([, a], [, b]) => b - a)[0];

    return {
      total,
      promedio,
      count: gastos.length,
      categoriaMax: categoriaMax ? { name: categoriaMax[0], value: categoriaMax[1] } : null,
    };
  }, [gastos]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Gastado</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  ${stats.total.toFixed(2)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Promedio</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  ${stats.promedio.toFixed(2)}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Total Gastos</dt>
                <dd className="text-lg font-semibold text-gray-900">{stats.count}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Mayor Categoría</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {stats.categoriaMax ? stats.categoriaMax.name : 'N/A'}
                </dd>
                {stats.categoriaMax && (
                  <dd className="text-xs text-gray-500">
                    ${stats.categoriaMax.value.toFixed(2)}
                  </dd>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
