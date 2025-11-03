'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  PieLabelRenderProps,
} from 'recharts';
import { Gasto } from '@/types';

interface ChartsProps {
  gastos: Gasto[];
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function Charts({ gastos }: ChartsProps) {
  // Aggregate data by category
  const categoryData = useMemo(() => {
    const aggregated: { [key: string]: number } = {};
    gastos.forEach((gasto) => {
      if (aggregated[gasto.categoria]) {
        aggregated[gasto.categoria] += gasto.monto;
      } else {
        aggregated[gasto.categoria] = gasto.monto;
      }
    });

    return Object.entries(aggregated).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }));
  }, [gastos]);

  // Aggregate data by month
  const monthlyData = useMemo(() => {
    const aggregated: { [key: string]: number } = {};
    gastos.forEach((gasto) => {
      const date = new Date(gasto.fecha);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (aggregated[monthKey]) {
        aggregated[monthKey] += gasto.monto;
      } else {
        aggregated[monthKey] = gasto.monto;
      }
    });

    return Object.entries(aggregated)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month,
        total: parseFloat(total.toFixed(2)),
      }));
  }, [gastos]);

  // Top expenses
  const topExpenses = useMemo(() => {
    return [...gastos]
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10)
      .map((gasto) => ({
        concepto: gasto.concepto.length > 20 ? gasto.concepto.substring(0, 20) + '...' : gasto.concepto,
        monto: parseFloat(gasto.monto.toFixed(2)),
      }));
  }, [gastos]);

  if (gastos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay datos disponibles para mostrar gráficos
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Category Distribution - Pie Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Categoría</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: PieLabelRenderProps) => {
                const { name, percent } = props as PieLabelRenderProps & { name: string; percent: number };
                return `${name}: ${(percent * 100).toFixed(0)}%`;
              }}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Trend - Line Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia Mensual</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Expenses - Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Gastos</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={topExpenses} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="concepto" type="category" width={150} />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="monto" fill="#10B981" name="Monto" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Comparison - Bar Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparación por Categoría</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="value" fill="#4F46E5" name="Total" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
