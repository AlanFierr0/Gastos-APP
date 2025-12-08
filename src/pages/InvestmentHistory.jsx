import React, {useEffect, useMemo, useState} from 'react';
import Card from '../components/Card.jsx';
import {capitalizeWords, formatMoneyNoDecimals} from '../utils/format.js';
import * as api from '../api/index.js';

export default function InvestmentHistory() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState({}); // { investmentId: [operations] }
  const [expandedInvestments, setExpandedInvestments] = useState(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  // Group investments by category type
  const groupedInvestments = useMemo(() => {
    const groups = {
      dolar: [],
      equity: [],
      crypto: [],
    };
    
    investments.forEach(inv => {
      const typeName = inv.category?.type?.name?.toLowerCase() || '';
      if (typeName === 'dolar') groups.dolar.push(inv);
      else if (typeName === 'equity') groups.equity.push(inv);
      else if (typeName === 'crypto') groups.crypto.push(inv);
    });
    
    return groups;
  }, [investments]);

  useEffect(() => {
    // Actualizar precios primero, luego cargar inversiones
    async function updateAndLoad() {
      try {
        // Primero cargar inversiones con precios actuales (por si falla la actualización)
        await loadInvestments();
        
        // Luego intentar actualizar los precios desde las APIs (silenciosamente)
        // Usar force=true para permitir actualización automática aunque haya pasado poco tiempo
        try {
          await api.updatePrices(true);
          // Luego actualizar los precios de las inversiones
          await api.updateInvestmentPrices();
          // Finalmente recargar las inversiones con precios actualizados
          await loadInvestments();
        } catch (updateError) {
          // Si falla la actualización, mantener los precios anteriores (ya cargados arriba)
          console.log('Price update failed, using cached prices:', updateError?.response?.data?.message || updateError?.message);
        }
      } catch (error) {
        console.error('Error loading investments:', error);
      }
    }
    updateAndLoad();
  }, []);

  useEffect(() => {
    if (investments.length > 0) {
      // Cargar operaciones para todas las inversiones
      investments.forEach(inv => {
        loadOperations(inv.id);
      });
    }
  }, [investments.length]);

  async function loadInvestments() {
    setLoading(true);
    try {
      const data = await api.getInvestments();
      // Mostrar TODAS las inversiones, incluyendo las que tienen cantidad 0
      setInvestments(data || []);
    } catch (error) {
      console.error('Error loading investments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOperations(investmentId) {
    try {
      const data = await api.getInvestmentOperations(investmentId);
      setOperations(prev => ({
        ...prev,
        [investmentId]: data || []
      }));
    } catch (error) {
      console.error('Error loading operations:', error);
    }
  }

  function toggleExpanded(investmentId) {
    setExpandedInvestments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(investmentId)) {
        newSet.delete(investmentId);
      } else {
        newSet.add(investmentId);
      }
      return newSet;
    });
  }

  function renderInvestmentGroup(typeName, investments) {
    // Filtrar por término de búsqueda si existe
    let filteredInvestments = investments;
    if (searchFilter.trim()) {
      const filterLower = searchFilter.trim().toLowerCase();
      filteredInvestments = investments.filter(inv => 
        (inv.concept || '').toLowerCase().includes(filterLower)
      );
    }
    
    if (filteredInvestments.length === 0) return null;

    const typeLabel = {
      dolar: 'Dólar',
      equity: 'Equity',
      crypto: 'Crypto',
    }[typeName] || typeName;

    // Ordenar por valor de mercado descendente para crypto y equity, por cantidad descendente para dólar
    const sortedInvestments = [...filteredInvestments];
    if (typeName === 'crypto' || typeName === 'equity') {
      sortedInvestments.sort((a, b) => {
        const valueA = (a.currentAmount || 0) * (a.currentPrice || 0);
        const valueB = (b.currentAmount || 0) * (b.currentPrice || 0);
        return valueB - valueA;
      });
    } else if (typeName === 'dolar') {
      sortedInvestments.sort((a, b) => {
        const amountA = a.currentAmount || 0;
        const amountB = b.currentAmount || 0;
        return amountB - amountA;
      });
    }

    // Calcular totales
    const totalCurrent = investments.reduce((sum, inv) => {
      const currentValue = (inv.currentAmount || 0) * (inv.currentPrice || 0);
      return sum + currentValue;
    }, 0);
    const totalCostBasis = investments.reduce((sum, inv) => {
      const invOperations = operations[inv.id] || [];
      const purchaseCost = invOperations
        .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
        .reduce((total, op) => total + (op.price * op.amount), 0);
      const costBasis = (inv.originalAmount || 0) + purchaseCost;
      return sum + costBasis;
    }, 0);
    const totalGain = totalCurrent - totalCostBasis;
    const totalGainPercent = totalCostBasis > 0 ? ((totalGain / totalCostBasis) * 100) : 0;
    
    // Para dólar, calcular total de cantidad y total de inversión original
    const totalAmount = investments.reduce((sum, inv) => sum + (inv.currentAmount || 0), 0);
    const totalOriginalAmount = investments.reduce((sum, inv) => {
      const invOperations = operations[inv.id] || [];
      const purchaseCost = invOperations
        .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
        .reduce((total, op) => total + (op.price * op.amount), 0);
      return sum + (inv.originalAmount || 0) + purchaseCost;
    }, 0);

    return (
      <Card key={typeName} title={typeLabel} className="mb-6">
        <div className="space-y-4">
          {/* Summary */}
          {typeName === 'dolar' ? (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Cantidad</p>
                <p className="text-lg font-bold">{totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Inversión Original</p>
                <p className="text-lg font-bold">{formatMoneyNoDecimals(totalOriginalAmount, 'ARS', { sign: 'none' })}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Actual</p>
                <p className="text-lg font-bold">{formatMoneyNoDecimals(totalCurrent, 'ARS', { sign: 'none' })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Original</p>
                <p className="text-lg font-bold">{formatMoneyNoDecimals(totalCostBasis, 'ARS', { sign: 'none' })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ganancia/Pérdida</p>
                <p className={`text-lg font-bold ${totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatMoneyNoDecimals(totalGain, 'ARS')} ({totalGainPercent >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}

          {sortedInvestments.map(inv => {
            const currentValue = (inv.currentAmount || 0) * (inv.currentPrice || 0);
            // Calcular costo total: inversión original + suma de precios de operaciones de compra
            const invOperations = operations[inv.id] || [];
            const purchaseCost = invOperations
              .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
              .reduce((total, op) => total + (op.price * op.amount), 0);
            const costBasis = (inv.originalAmount || 0) + purchaseCost;
            const gain = currentValue - costBasis;
            const gainPercent = costBasis > 0 ? ((gain / costBasis) * 100) : 0;
            const isExpanded = expandedInvestments.has(inv.id);

            // Calcular el estado acumulado después de cada operación
            // Primero, calcular la cantidad inicial trabajando hacia atrás desde currentAmount
            let initialAmount = inv.currentAmount || 0;
            // Aplicar las operaciones en orden inverso para obtener la cantidad inicial
            for (let i = invOperations.length - 1; i >= 0; i--) {
              const op = invOperations[i];
              if (op.type === 'COMPRA') {
                initialAmount -= op.amount;
              } else if (op.type === 'VENTA') {
                initialAmount += op.amount;
              } else if (op.type === 'AJUSTE') {
                // Para ajuste, la cantidad antes es la cantidad que había antes del ajuste
                // Como el ajuste establece la cantidad a op.amount, la cantidad antes era la que había antes
                // Pero no podemos saberla exactamente, así que usamos la cantidad calculada hasta ahora
                // (no cambiamos initialAmount porque ya estamos trabajando hacia atrás)
              }
            }
            
            // Asegurar que la cantidad inicial no sea negativa
            initialAmount = Math.max(0, initialAmount);
            
            // Ahora calcular hacia adelante desde la cantidad inicial
            let runningAmount = initialAmount;
            const operationsWithState = invOperations.map(op => {
              const beforeAmount = runningAmount;
              let afterAmount = beforeAmount;
              if (op.type === 'COMPRA') {
                afterAmount += op.amount;
              } else if (op.type === 'VENTA') {
                afterAmount -= op.amount;
              } else if (op.type === 'AJUSTE') {
                afterAmount = op.amount;
              }
              const state = { before: beforeAmount, after: afterAmount };
              runningAmount = afterAmount;
              return { ...op, state };
            });

            return (
              <div key={inv.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {/* Header de la inversión */}
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2"
                  onClick={() => toggleExpanded(inv.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold">{inv.concept}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {inv.category?.type?.name && capitalizeWords(inv.category.type.name)}
                      </span>
                      {inv.custodyEntity && (
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          {inv.custodyEntity}
                        </span>
                      )}
                    </div>
                    {typeName === 'dolar' ? (
                      <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Cantidad Actual:</span>
                          <span className="ml-2 font-semibold">
                            {inv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Entidad de Custodia:</span>
                          <span className="ml-2 font-semibold">
                            {inv.custodyEntity || '-'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={`grid gap-4 mt-2 text-sm ${(typeName === 'crypto' || typeName === 'equity') ? 'grid-cols-5' : 'grid-cols-4'}`}>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Cantidad Actual:</span>
                          <span className="ml-2 font-semibold">
                            {inv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Precio Actual:</span>
                          <span className="ml-2 font-semibold">
                            {inv.currentPrice ? formatMoneyNoDecimals(inv.currentPrice, 'ARS', { sign: 'none' }) : '-'}
                          </span>
                        </div>
                        {(typeName === 'crypto' || typeName === 'equity') && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Valor de Mercado:</span>
                            <span className="ml-2 font-semibold">
                              {formatMoneyNoDecimals(currentValue, 'ARS', { sign: 'none' })}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Inversión Original:</span>
                          <span className="ml-2 font-semibold">
                            {formatMoneyNoDecimals(costBasis, 'ARS', { sign: 'none' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Ganancia/Pérdida:</span>
                          <span className={`ml-2 font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoneyNoDecimals(gain, 'ARS')} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {invOperations.length} operación{invOperations.length !== 1 ? 'es' : ''}
                    </span>
                    <span className="material-symbols-outlined text-gray-400" style={{ 
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s'
                    }}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Historial de operaciones expandido */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {invOperations.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No hay operaciones registradas para esta inversión.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {/* Resumen inicial */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Inversión Original</p>
                              <p className="text-lg font-bold">{formatMoneyNoDecimals(inv.originalAmount, 'ARS', { sign: 'none' })}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Cantidad Actual</p>
                              <p className="text-lg font-bold">{inv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>

                        {/* Lista de operaciones */}
                        <div className="space-y-3">
                          {operationsWithState.map((op) => (
                            <div
                              key={op.id}
                              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span
                                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        op.type === 'COMPRA'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                          : op.type === 'VENTA'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                      }`}
                                    >
                                      {op.type}
                                    </span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {new Date(op.date || op.createdAt).toLocaleDateString('es-AR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad</p>
                                      <p className="font-semibold">
                                        {op.type === 'AJUSTE' 
                                          ? op.amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                                          : `${op.type === 'COMPRA' ? '+' : '-'}${op.amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                        }
                                      </p>
                                    </div>
                                    {op.price && (
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Precio por Unidad</p>
                                        <p className="font-semibold">{formatMoneyNoDecimals(op.price, 'ARS', { sign: 'none' })}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad Antes</p>
                                      <p className="font-semibold">{op.state.before.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad Después</p>
                                      <p className="font-semibold">{op.state.after.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                                    </div>
                                  </div>
                                  {op.note && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">Nota</p>
                                      <p className="text-sm">{op.note}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">Historial de Inversiones</p>
          <p className="text-[#616f89] dark:text-gray-400">Visualiza todas las inversiones y su historial completo de operaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar por concepto..."
              className="h-9 px-3 pl-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64"
            />
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              search
            </span>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Limpiar búsqueda"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-center text-gray-500">Cargando...</p>
      ) : (
        <>
          {renderInvestmentGroup('dolar', groupedInvestments.dolar)}
          {renderInvestmentGroup('equity', groupedInvestments.equity)}
          {renderInvestmentGroup('crypto', groupedInvestments.crypto)}
          
          {investments.length === 0 && (
            <Card>
              <p className="text-center text-gray-500">No hay inversiones registradas.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}




