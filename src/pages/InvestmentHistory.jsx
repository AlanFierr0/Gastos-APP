import React, {useEffect, useMemo, useState} from 'react';
import Card from '../components/Card.jsx';
import {capitalizeWords, formatMoneyNoDecimals} from '../utils/format.js';
import * as api from '../api/index.js';

export default function InvestmentHistory() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState({}); // { investmentId: [operations] }
  const [expandedInvestments, setExpandedInvestments] = useState(new Set());

  // Group investments by category type
  const groupedInvestments = useMemo(() => {
    const groups = {
      moneda: [],
      equity: [],
      crypto: [],
    };
    
    investments.forEach(inv => {
      const typeName = inv.category?.type?.name?.toLowerCase() || '';
      if (typeName === 'moneda') groups.moneda.push(inv);
      else if (typeName === 'equity') groups.equity.push(inv);
      else if (typeName === 'crypto') groups.crypto.push(inv);
    });
    
    return groups;
  }, [investments]);

  useEffect(() => {
    loadInvestments();
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
    if (investments.length === 0) return null;

    const typeLabel = {
      moneda: 'Moneda',
      equity: 'Equity',
      crypto: 'Crypto',
    }[typeName] || typeName;

    return (
      <Card key={typeName} title={typeLabel} className="mb-6">
        <div className="space-y-4">
          {investments.map(inv => {
            const currentValue = (inv.currentAmount || 0) * (inv.currentPrice || 0);
            const gain = currentValue - inv.originalAmount;
            const gainPercent = inv.originalAmount > 0 ? ((gain / inv.originalAmount) * 100) : 0;
            const invOperations = operations[inv.id] || [];
            const isExpanded = expandedInvestments.has(inv.id);

            // Calcular el estado acumulado después de cada operación
            let runningAmount = inv.originalAmount;
            const operationsWithState = invOperations.map(op => {
              let newAmount = runningAmount;
              if (op.type === 'COMPRA') {
                newAmount += op.amount;
              } else if (op.type === 'VENTA') {
                newAmount -= op.amount;
              } else if (op.type === 'AJUSTE') {
                newAmount = op.amount;
              }
              const state = { before: runningAmount, after: newAmount };
              runningAmount = newAmount;
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
                    <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
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
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Inversión Original:</span>
                        <span className="ml-2 font-semibold">
                          {formatMoneyNoDecimals(inv.originalAmount, 'ARS', { sign: 'none' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Ganancia/Pérdida:</span>
                        <span className={`ml-2 font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoneyNoDecimals(gain, 'ARS')} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
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
                                      {new Date(op.createdAt).toLocaleDateString('es-AR', {
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
      </header>

      {loading ? (
        <p className="text-center text-gray-500">Cargando...</p>
      ) : (
        <>
          {renderInvestmentGroup('moneda', groupedInvestments.moneda)}
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

