import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Gasto, FilterOptions } from '@/types';

export function useGastos(filters?: FilterOptions) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGastos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters?.categoria) params.append('categoria', filters.categoria);
      if (filters?.fechaInicio) params.append('fechaInicio', filters.fechaInicio);
      if (filters?.fechaFin) params.append('fechaFin', filters.fechaFin);
      if (filters?.montoMin !== undefined) params.append('montoMin', filters.montoMin.toString());
      if (filters?.montoMax !== undefined) params.append('montoMax', filters.montoMax.toString());

      const response = await api.get(`/gastos?${params.toString()}`);
      setGastos(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar los gastos');
      console.error('Error fetching gastos:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  return { gastos, loading, error, refetch: fetchGastos };
}
