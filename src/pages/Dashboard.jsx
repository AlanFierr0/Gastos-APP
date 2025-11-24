import React, {useMemo, useState, useEffect} from 'react';
import Card from '../components/Card.jsx';
import {useApp} from '../context/AppContext.jsx';
import {formatMoneyNoDecimals, capitalizeWords, formatNumber, extractYearMonth} from '../utils/format.js';
import {useNavigate} from 'react-router-dom';
import {BarCompare, PieBreakdown} from '../components/Chart.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import * as api from '../api/index.js';

export default function Dashboard() {
  const { expenses, income, t } = useApp();
  const [investments, setInvestments] = useState([]);
  const [operations, setOperations] = useState({}); // { investmentId: [operations] }
  const [periodType, setPeriodType] = useState('month'); // 'month' | 'year'
  const [selectedPeriod, setSelectedPeriod] = useState(() => getLastNonForecastMonth());
  const [gbpPrice, setGbpPrice] = useState(null);
  const navigate = useNavigate();
  
  // Calculate current month on each render to ensure it's always fresh
  const lastNonForecastMonth = useMemo(() => getLastNonForecastMonth(), []);

  // (moved below, after periodOptions declaration)

  // Determine selected year for month mode
  const selectedYear = useMemo(() => {
    const [yStr] = String(selectedPeriod || lastNonForecastMonth).split('-');
    return Number(yStr) || new Date().getFullYear();
  }, [selectedPeriod, lastNonForecastMonth]);

  // Build 12 months for the selected year (always available)
  const months = useMemo(() => buildFullYearMonths(selectedYear, 'es-AR'), [selectedYear]);
  const years = useMemo(() => buildAvailableYears(expenses, income), [expenses, income]);
  const periodOptions = periodType === 'month' ? months : years;

  // Ensure a valid month only when switching to month mode or when options update
  React.useEffect(() => {
    if (periodType !== 'month') return;
    const isValid = Array.isArray(periodOptions) && periodOptions.some((p) => p.value === selectedPeriod);
    if (!isValid) setSelectedPeriod(lastNonForecastMonth);
  }, [periodType, periodOptions, selectedPeriod, lastNonForecastMonth]);

  // Always use last non-forecast month if selectedPeriod is not in options (for initial load)
  const effectivePeriod = useMemo(() => {
    let result;
    if (periodOptions.length) {
      const isInOptions = periodOptions.some((p) => p.value === selectedPeriod);
      result = isInOptions ? selectedPeriod : (periodType === 'month' ? lastNonForecastMonth : periodOptions[0].value);
    } else {
      result = periodType === 'month' ? lastNonForecastMonth : String(new Date().getFullYear());
    }
    return result;
  }, [periodOptions, selectedPeriod, lastNonForecastMonth, periodType]);

  // Check if the selected period is forecast (only for month view)
  const isForecastPeriod = useMemo(() => {
    if (periodType === 'month') {
      const [yStr, mStr] = (effectivePeriod || '').split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (y && m) {
        return isForecastMonth(y, m);
      }
    }
    // For year view, never show forecast warning - always use real data only
    return false;
  }, [periodType, effectivePeriod]);

  const { periodExpenses, periodIncome } = useMemo(() => {
    // For month view: if it's a forecast period, include forecast data; otherwise exclude it
    // For year view: always exclude forecast data (only show real data)
    return periodType === 'month'
      ? (isForecastPeriod 
          ? filterByMonthIncludingForecast(expenses, income, effectivePeriod)
          : filterByMonth(expenses, income, effectivePeriod))
      : filterByYear(expenses, income, Number(effectivePeriod)); // Always exclude forecast for year view
  }, [expenses, income, periodType, effectivePeriod, isForecastPeriod]);

  const monthTotals = useMemo(() => computeTotals(periodExpenses, periodIncome), [periodExpenses, periodIncome]);

  const previousPeriodTotals = useMemo(() => {
    let prevPeriod;
    let prevPeriodLabel;
    if (periodType === 'month') {
      const [y, m] = effectivePeriod.split('-').map(Number);
      const prevDate = new Date(Date.UTC(y, m - 2, 1));
      prevPeriod = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
      // Get label from periodOptions
      const prevOption = periodOptions.find((p) => p.value === prevPeriod);
      prevPeriodLabel = prevOption?.label || prevPeriod;
    } else {
      prevPeriod = String(Number(effectivePeriod) - 1);
      prevPeriodLabel = prevPeriod;
    }
    if (!prevPeriod) return null;
    const prev = periodType === 'month'
      ? filterByMonth(expenses, income, prevPeriod)
      : filterByYear(expenses, income, Number(prevPeriod));
    const totals = computeTotals(prev.periodExpenses, prev.periodIncome);
    return { ...totals, periodLabel: prevPeriodLabel };
  }, [periodType, effectivePeriod, expenses, income, periodOptions]);

  const trends = useMemo(() => {
    if (!previousPeriodTotals) {
      return {
        income: null,
        expenses: null,
        balance: monthTotals.balance >= 0 ? { positive: true, label: 'Positive' } : { positive: false, label: 'Negative' },
      };
    }
    const calcChange = (curr, prev) => {
      if (!prev || prev === 0) return null;
      const change = ((curr - prev) / prev) * 100;
      return { value: change, positive: change >= 0 };
    };
    
    // Special calculation for balance: when both are negative, we need to invert the logic
    const calcBalanceChange = (curr, prev) => {
      if (!prev || prev === 0) return null;
      // If both are negative, calculate the absolute change
      if (curr < 0 && prev < 0) {
        // More negative = worse (negative change)
        // Less negative = better (positive change)
        const change = ((Math.abs(curr) - Math.abs(prev)) / Math.abs(prev)) * 100;
        // If current is more negative (worse), change should be negative
        const isWorse = Math.abs(curr) > Math.abs(prev);
        return { value: isWorse ? -Math.abs(change) : Math.abs(change), positive: !isWorse };
      }
      // For other cases, use normal calculation
      const change = ((curr - prev) / prev) * 100;
      return { value: change, positive: change >= 0 };
    };
    
    const incomeChange = calcChange(monthTotals.totalIncome, previousPeriodTotals.totalIncome);
    const expensesChange = calcChange(monthTotals.totalExpenses, previousPeriodTotals.totalExpenses);
    const comparisonLabel = periodType === 'month' 
      ? (t('vsPreviousMonth') || 'vs. Mes anterior')
      : (t('vsPreviousYear') || 'vs. Año anterior');
    return {
      income: incomeChange ? { 
        ...incomeChange, 
        positive: incomeChange.positive,
        previousValue: previousPeriodTotals.totalIncome,
        comparisonLabel 
      } : null,
      expenses: expensesChange ? { 
        ...expensesChange, 
        positive: !expensesChange.positive, // Inverted: more expenses = bad (red)
        previousValue: previousPeriodTotals.totalExpenses,
        comparisonLabel
      } : null,
      balance: monthTotals.balance >= 0
        ? { 
            positive: true, 
            label: 'Positive', 
            change: calcChange(monthTotals.balance, previousPeriodTotals.balance),
            previousValue: previousPeriodTotals.balance,
            comparisonLabel
          }
        : { 
            positive: false, 
            label: 'Negative', 
            change: calcBalanceChange(monthTotals.balance, previousPeriodTotals.balance),
            previousValue: previousPeriodTotals.balance,
            comparisonLabel
          },
    };
  }, [monthTotals, previousPeriodTotals, periodType, t]);

  const { pieData, othersCategories } = useMemo(() => {
    // Sumar exactamente como en la Grilla: montos crudos por categoría
    const map = new Map();
    for (const e of (periodExpenses || [])) {
      const name = (typeof e.category === 'object' && e.category)
        ? (e.category.name || t('expenseGeneric'))
        : (e.category || t('expenseGeneric'));
      const amount = Number(e.amount || 0);
      if (!isNaN(amount) && isFinite(amount)) {
        map.set(name, (map.get(name) || 0) + amount);
      }
    }

    // Convertir a array y mantener solo categorías con total positivo
    let allData = Array.from(map.entries())
      .map(([name, value]) => ({ name: capitalizeWords(name), value: Number(value), originalName: name }))
      .filter(item => item.value > 0);

    if (allData.length === 0) return { pieData: [], othersCategories: [] };

    // Total para umbral de "Otros"
    const total = allData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return { pieData: [], othersCategories: [] };

    const threshold = total * 0.02; // 2%
    const mainCategories = [];
    let othersSum = 0;
    const othersCats = [];

    for (const item of allData) {
      if (item.value >= threshold) {
        mainCategories.push({ name: item.name, value: item.value, originalName: item.originalName });
      } else {
        othersSum += item.value;
        othersCats.push(item.originalName);
      }
    }

    mainCategories.sort((a, b) => b.value - a.value);
    if (othersSum > 0) mainCategories.push({ name: 'Otros', value: othersSum });

    return { pieData: mainCategories, othersCategories: othersCats };
  }, [periodExpenses, t]);

  // Only current selected period
  const barData = useMemo(() => {
    const label = (periodOptions.find((p) => p.value === effectivePeriod)?.label) || effectivePeriod;
    const incomeValue = Math.abs(Number(monthTotals.totalIncome || 0));
    const expensesValue = Math.abs(Number(monthTotals.totalExpenses || 0));
    // Both income and expenses should be positive to appear above zero line
    return [{ name: label, income: incomeValue, expenses: expensesValue }];
  }, [periodOptions, effectivePeriod, monthTotals]);


  function handleGoToInvestment(action = null) {
    navigate('/investment', { state: { openForm: action } });
  }

  useEffect(() => {
    // Actualizar precios primero, luego cargar inversiones
    async function updateAndLoad() {
      try {
        // Primero actualizar los precios desde las APIs
        await api.updatePrices();
        // Luego actualizar los precios de las inversiones
        await api.updateInvestmentPrices();
      } catch (error) {
        console.error('Error updating prices silently:', error);
        // Continuar aunque falle la actualización
      }
      // Cargar inversiones después de actualizar precios
      try {
        const data = await api.getInvestments();
        setInvestments(data || []);
      } catch (error) {
        console.error('Error loading investments:', error);
      }
      loadGbpPrice();
    }
    updateAndLoad();
  }, []);

  async function loadGbpPrice() {
    try {
      // Intentar con diferentes símbolos posibles
      let price = await api.getPrice('GBPUSD=X');
      
      // Si no funciona, intentar sin el =X
      if (!price || price <= 0) {
        price = await api.getPrice('GBPUSD');
      }
      
      // Si aún no funciona, intentar con otro formato
      if (!price || price <= 0) {
        price = await api.getPrice('GBP/USD');
      }
      
      if (price && price > 0) {
        setGbpPrice(price);
      }
    } catch (error) {
      console.error('Error loading GBP price:', error);
    }
  }

  useEffect(() => {
    if (investments.length > 0) {
      // Cargar operaciones para todas las inversiones
      investments.forEach(inv => {
        loadOperations(inv.id);
      });
    }
  }, [investments.length]);

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

  // Calcular métricas de inversiones
  const investmentMetrics = useMemo(() => {
    if (!investments || investments.length === 0) {
      return {
        totalCurrent: 0,
        totalOriginal: 0,
        totalGain: 0,
        totalGainPercent: 0,
        totalInvestments: 0,
        totalOperations: 0,
        byType: {
          crypto: { current: 0, original: 0, gain: 0, count: 0 },
          equity: { current: 0, original: 0, gain: 0, count: 0 },
          dolar: { current: 0, original: 0, gain: 0, count: 0 },
        },
      };
    }

    let totalCurrent = 0;
    let totalOriginal = 0;
    let totalOperationsCount = 0;
    const byType = {
      crypto: { current: 0, original: 0, gain: 0, count: 0 },
      equity: { current: 0, original: 0, gain: 0, count: 0 },
      dolar: { current: 0, original: 0, gain: 0, count: 0 },
    };

    investments.forEach(inv => {
      const typeName = inv.category?.type?.name?.toLowerCase() || '';
      
      // Usar precio directamente de la DB (ya está transformado)
      const price = inv.currentPrice || 0;
      
      // Para dólar, el valor actual es simplemente la cantidad (no se multiplica por precio)
      // Para crypto y equity, se multiplica cantidad por precio (ya transformado en DB)
      const currentValue = typeName === 'dolar' 
        ? (inv.currentAmount || 0)
        : (inv.currentAmount || 0) * price;
      
      // Calcular costo total: inversión original + suma de precios de operaciones de compra
      const invOperations = operations[inv.id] || [];
      totalOperationsCount += invOperations.length;
      const purchaseCost = invOperations
        .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
        .reduce((total, op) => {
          // Los precios de operaciones también están transformados en la DB
          return total + (op.price * op.amount);
        }, 0);
      const costBasis = (inv.originalAmount || 0) + purchaseCost;
      const gain = currentValue - costBasis;

      totalCurrent += currentValue;
      totalOriginal += costBasis;

      if (byType[typeName]) {
        byType[typeName].current += currentValue;
        byType[typeName].original += costBasis;
        byType[typeName].gain += gain;
        byType[typeName].count += 1;
      }
    });

    const totalGain = totalCurrent - totalOriginal;
    const totalGainPercent = totalOriginal > 0 ? ((totalGain / totalOriginal) * 100) : 0;

    return {
      totalCurrent,
      totalOriginal,
      totalGain,
      totalGainPercent,
      totalInvestments: investments.length,
      totalOperations: totalOperationsCount,
      byType,
    };
  }, [investments, operations, gbpPrice]);

  // Datos para el gráfico de distribución por tipo
  // Siempre mostrar los tres tipos: Crypto, Equity y Dólar
  // Ordenados por porcentaje del total (de mayor a menor)
  const investmentPieData = useMemo(() => {
    const data = [
      {
        name: 'Crypto',
        value: investmentMetrics.byType.crypto.current,
        original: investmentMetrics.byType.crypto.original,
        gain: investmentMetrics.byType.crypto.gain,
        count: investmentMetrics.byType.crypto.count,
      },
      {
        name: 'Equity',
        value: investmentMetrics.byType.equity.current,
        original: investmentMetrics.byType.equity.original,
        gain: investmentMetrics.byType.equity.gain,
        count: investmentMetrics.byType.equity.count,
      },
      {
        name: 'Dólar',
        value: investmentMetrics.byType.dolar.current,
        original: investmentMetrics.byType.dolar.original,
        gain: investmentMetrics.byType.dolar.gain,
        count: investmentMetrics.byType.dolar.count,
      },
    ];
    
    // Ordenar por porcentaje del total (de mayor a menor)
    return data.sort((a, b) => {
      const percentageA = investmentMetrics.totalCurrent > 0 
        ? ((a.value / investmentMetrics.totalCurrent) * 100) 
        : 0;
      const percentageB = investmentMetrics.totalCurrent > 0 
        ? ((b.value / investmentMetrics.totalCurrent) * 100) 
        : 0;
      return percentageB - percentageA; // Orden descendente (mayor a menor)
    });
  }, [investmentMetrics]);

  return (
    <div className="flex flex-col gap-6 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">{t('summaryTitle')}</p>
          <p className="text-[#616f89] dark:text-gray-400">{t('summarySub')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGoToInvestment('investment')}
            className="h-9 px-3 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
          >
            Agregar Inversión
          </button>
          <button
            onClick={() => handleGoToInvestment('operation')}
            className="h-9 px-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Agregar Operación
          </button>
          <CustomSelect
            value={periodType}
            onChange={(v) => {
              setPeriodType(v);
              setSelectedPeriod(v === 'month' ? lastNonForecastMonth : String(new Date().getFullYear()));
            }}
            options={[
              { value: 'month', label: t('periodMonth') },
              { value: 'year', label: t('periodYear') },
            ]}
          />
          <CustomSelect
            value={effectivePeriod}
            onChange={(v) => setSelectedPeriod(v)}
            options={periodOptions}
          />
        </div>
      </header>

      {isForecastPeriod && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 flex-shrink-0">warning</span>
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">{t('forecastWarning') || 'Este es un mes pronóstico'}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{t('forecastWarningMessage') || 'No hay datos reales para este período. Los valores mostrados son pronósticos.'}</p>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title={t('totalIncome')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.totalIncome, 'ARS', { sign: 'none' })}
          </p>
          {trends.income && (
            <div className="mt-2 space-y-1">
              <div className={`flex items-center gap-1 text-sm ${trends.income.positive ? 'text-green-600' : 'text-red-500'}`}>
                <span>{trends.income.positive ? '+' : '-'}{formatNumber(Math.abs(trends.income.value), 1)}%</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {trends.income.comparisonLabel}: {formatMoneyNoDecimals(trends.income.previousValue, 'ARS', { sign: 'none' })}
              </div>
            </div>
          )}
        </Card>
        <Card title={t('totalExpenses')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.totalExpenses, 'ARS', { sign: 'none' })}
          </p>
          {trends.expenses && (
            <div className="mt-2 space-y-1">
              <div className={`flex items-center gap-1 text-sm ${trends.expenses.positive ? 'text-green-600' : 'text-red-500'}`}>
                <span>{trends.expenses.positive ? '+' : '-'}{formatNumber(Math.abs(trends.expenses.value), 1)}%</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {trends.expenses.comparisonLabel}: {formatMoneyNoDecimals(trends.expenses.previousValue, 'ARS', { sign: 'none' })}
              </div>
            </div>
          )}
        </Card>
        <Card title={t('netBalance')}>
          <p className="text-3xl font-bold">
            <span className="text-sm font-normal mr-1">ARS</span>
            {formatMoneyNoDecimals(monthTotals.balance, 'ARS')}
          </p>
          {trends.balance && (
            <div className="mt-2 space-y-1">
              {trends.balance.change ? (
                <>
                  <div className={`flex items-center gap-1 text-sm ${trends.balance.change.positive ? 'text-green-600' : 'text-red-500'}`}>
                    <span>{trends.balance.change.value >= 0 ? '+' : ''}{formatNumber(trends.balance.change.value, 1)}%</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {trends.balance.comparisonLabel}: {formatMoneyNoDecimals(trends.balance.previousValue, 'ARS')}
                  </div>
                </>
              ) : (
                <div className={`flex items-center gap-1 text-sm ${trends.balance.positive ? 'text-green-600' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-sm">{trends.balance.positive ? 'check_circle' : 'cancel'}</span>
                  <span>{trends.balance.label}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {investmentMetrics.totalCurrent > 0 && (
          <>
            {/* Columna izquierda: Gráficos de torta apilados */}
            <div className="lg:col-span-1 space-y-6">
              <Card title="Distribución de Inversiones">
                <PieBreakdown 
                  data={investmentPieData
                    .filter(item => item.value > 0) // Solo mostrar en el gráfico los que tienen valor
                    .map(item => ({
                      name: item.name,
                      value: item.value,
                    }))}
                  onCategoryClick={() => {
                    navigate('/investment');
                  }}
                />
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Inversiones</p>
                      <p className="font-semibold text-base">{investmentMetrics.totalInvestments}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Operaciones</p>
                      <p className="font-semibold text-base">{investmentMetrics.totalOperations}</p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card title={t('expenseBreakdown')}>
                {pieData.length ? (
                  <PieBreakdown 
                    data={pieData} 
                    onCategoryClick={(categoryName) => {
                      // If clicking on "Otros", pass all the categories that form it
                      if (categoryName === 'Otros') {
                        navigate('/spreadsheet', { state: { filterCategories: othersCategories } });
                      } else {
                        // Find the originalName for the clicked category
                        const categoryData = pieData.find(item => item.name === categoryName);
                        const originalCategoryName = categoryData?.originalName || categoryName;
                        navigate('/spreadsheet', { state: { filterCategory: originalCategoryName } });
                      }
                    }}
                  />
                ) : (
                  <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
                )}
              </Card>
            </div>
            {/* Columna central: Detalle por tipo */}
            <Card title="Detalle por Tipo" className="lg:col-span-2">
              <div className="space-y-4">
                {/* Totales Generales */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">Total General</h3>
                    <span className={`text-lg font-bold ${investmentMetrics.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMoneyNoDecimals(investmentMetrics.totalGain, 'ARS')} ({investmentMetrics.totalGainPercent >= 0 ? '+' : ''}{formatNumber(investmentMetrics.totalGainPercent, 2)}%)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Valor Actual Total</p>
                      <p className="font-semibold text-base">{formatMoneyNoDecimals(investmentMetrics.totalCurrent, 'ARS', { sign: 'none' })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Inversión Original Total</p>
                      <p className="font-semibold text-base">{formatMoneyNoDecimals(investmentMetrics.totalOriginal, 'ARS', { sign: 'none' })}</p>
                    </div>
                  </div>
                </div>
                
                {/* Detalle por Tipo */}
                {investmentPieData.map(item => {
                  const gainPercent = item.original > 0 ? ((item.gain / item.original) * 100) : 0;
                  const percentageOfTotal = investmentMetrics.totalCurrent > 0 
                    ? ((item.value / investmentMetrics.totalCurrent) * 100) 
                    : 0;
                  return (
                    <div key={item.name} className="border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-700 dark:text-gray-300">{item.name}</h4>
                          {item.count > 0 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                              {item.count} {item.count === 1 ? 'inversión' : 'inversiones'}
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${item.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoneyNoDecimals(item.gain, 'ARS')} ({gainPercent >= 0 ? '+' : ''}{formatNumber(gainPercent, 2)}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Valor Actual</p>
                          <p className="font-medium">{formatMoneyNoDecimals(item.value, 'ARS', { sign: 'none' })}</p>
                          {investmentMetrics.totalCurrent > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {formatNumber(percentageOfTotal, 1)}% del total
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Inversión Original</p>
                          <p className="font-medium">{formatMoneyNoDecimals(item.original, 'ARS', { sign: 'none' })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
        <Card title={t('incomeVsExpenses')} className={investmentMetrics.totalCurrent > 0 ? "lg:col-span-1" : "lg:col-span-3"}>
          {barData.length ? (
            <BarCompare 
              data={barData} 
              tooltipLabelFromDatum={false}
              customTooltip={({ active, payload }) => {
                if (active && payload && payload.length) {
                  // With shared={false}, payload should only contain the hovered bar
                  const activeEntry = payload[0];
                  if (!activeEntry) return null;
                  
                  const isDark = document.documentElement.classList.contains('dark');
                  const absValue = Math.abs(activeEntry.value || 0);
                        const formatted = absValue.toLocaleString('es-AR', { 
                          style: 'currency', 
                          currency: 'ARS',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        });
                  
                  // Translate the label based on dataKey
                  let label;
                  if (activeEntry.dataKey === 'income') {
                          label = t('incomeGeneric') || 'Ingreso';
                  } else if (activeEntry.dataKey === 'expenses') {
                          label = t('expenseGeneric') || 'Gasto';
                  } else {
                    label = activeEntry.name || '';
                        }
                  
                        return (
                    <div 
                      className={`rounded-lg border p-2 shadow-lg z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                      style={isDark ? { backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(55 65 81)' } : {}}
                    >
                          <p 
                            className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
                            style={isDark ? { color: 'rgb(243 244 246)', backgroundColor: 'transparent' } : {}}
                          >
                        <span style={{ color: activeEntry.color || (isDark ? 'rgb(243 244 246)' : '#000') }} className="category-name">{label}: </span>
                            {formatted}
                          </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          ) : (
            <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noData')}</p>
          )}
        </Card>
      </section>
    </div>
  );
}
function getLastNonForecastMonth() {
  const now = new Date();
  let year, month;
  
  // Try to get Argentina timezone first
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Argentina/Buenos_Aires', 
      year: 'numeric', 
      month: '2-digit' 
    });
    const parts = formatter.formatToParts(now);
    const yearPart = parts.find((p) => p.type === 'year');
    const monthPart = parts.find((p) => p.type === 'month');
    
    if (yearPart && monthPart) {
      year = Number(yearPart.value);
      month = Number(monthPart.value);
    } else {
      // Fallback: use local time
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
  } catch (e) {
    // Fallback: use local time if Intl fails
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }
  
  // Current month is always forecast (month >= current month), so go back one month
  // This gives us the last completed month
  month--;
  if (month < 1) {
    month = 12;
    year--;
  }
  
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isForecastMonth(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If year is in the future, it's forecast
  if (year > currentYear) return true;
  // If year is in the past, it's not forecast
  if (year < currentYear) return false;
  // If same year, month >= current month is forecast
  return month >= currentMonth;
}


function buildFullYearMonths(year) {
  const arr = [];
  for (let m = 1; m <= 12; m += 1) {
    // Use a mid-month UTC date and fixed timezone to avoid month shifting by TZ
    const date = new Date(Date.UTC(year, m - 1, 15, 12, 0, 0));
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(date);
    const three = raw.replace('.', '').slice(0, 3);
    const monthAbbr = three.charAt(0).toUpperCase() + three.slice(1);
    const label = `${monthAbbr} ${year}`;
    arr.push({ value: `${year}-${String(m).padStart(2, '0')}`, label });
  }
  // order descending to match previous behavior
  return arr.sort((a, b) => (a.value < b.value ? 1 : -1));
}

function buildAvailableYears(expenses = [], income = []) {
  const set = new Set();
  const add = (ts) => {
    const ym = extractYearMonth(ts);
    if (!ym) return;
    set.add(String(ym.year));
  };
  income.forEach((i) => add(i.date));
  expenses.forEach((e) => add(e.date));
  if (set.size === 0) set.add(String(new Date().getFullYear()));
  const values = Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  return values.map((v) => ({ value: v, label: v }));
}

function filterByMonth(expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  
  // Filter expenses: only those in the specific month AND not forecast
  const periodExpenses = expenses.filter((e) => {
    const ym = extractYearMonth(e.date);
    if (!ym) return false;
    if (!inMonth(e.date)) return false;
    // Exclude forecast months
    return !isForecastMonth(ym.year, ym.month);
  });
  
  // Filter income: include both regular income in the month AND recurring income that started before or in this month
  // But exclude forecast months
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started on or before this month
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      // Include if the recurring income started in this month or earlier
      const matches = (incomeYm.year < y) || (incomeYm.year === y && incomeYm.month <= m);
      if (!matches) return false;
      // Exclude if the selected month is forecast
      return !isForecastMonth(y, m);
    }
    // For non-recurring income, only include if it's in this month and not forecast
    const ym = extractYearMonth(i.date);
    if (!ym || !inMonth(i.date)) return false;
    return !isForecastMonth(ym.year, ym.month);
  });
  
  return { periodIncome, periodExpenses };
}

function filterByYear(expenses = [], income = [], year) {
  const inYear = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === year;
  };
  
  // Filter expenses: only those in the specific year AND not forecast
  const periodExpenses = expenses.filter((e) => {
    const ym = extractYearMonth(e.date);
    if (!ym || !inYear(e.date)) return false;
    // Exclude forecast months
    return !isForecastMonth(ym.year, ym.month);
  });
  
  // Filter income: include both regular income in the year AND recurring income that started before or in this year
  // But exclude forecast months
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started in this year or earlier
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      if (incomeYm.year > year) return false;
      // For recurring income, we need to check if any month in the year is forecast
      // Since we're filtering by year, we'll exclude if the year is current and has forecast months
      const now = new Date();
      const currentYear = now.getFullYear();
      if (year === currentYear) {
        // For current year, exclude if the recurring income would fall in forecast months
        // This is a simplification - we'll exclude all recurring income for current year
        // if any month in the year is forecast
        // If we're in the current year and there are forecast months, exclude recurring income
        // that would contribute to forecast months
        return true; // We'll handle this more carefully by checking the actual month
      }
      return true;
    }
    // For non-recurring income, only include if it's in this year and not forecast
    const ym = extractYearMonth(i.date);
    if (!ym || !inYear(i.date)) return false;
    return !isForecastMonth(ym.year, ym.month);
  });
  
  return { periodIncome, periodExpenses };
}

function filterByMonthIncludingForecast(expenses = [], income = [], yearMonth) {
  const [yStr, mStr] = (yearMonth || '').split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const inMonth = (ts) => {
    const ym = extractYearMonth(ts);
    return ym && ym.year === y && ym.month === m;
  };
  
  // Filter expenses: only those in the specific month (including forecast)
  const periodExpenses = expenses.filter((e) => inMonth(e.date));
  
  // Filter income: include both regular income in the month AND recurring income that started before or in this month
  const periodIncome = income.filter((i) => {
    // If it's recurring income, include it if it started on or before this month
    if (i.isRecurring) {
      const incomeYm = extractYearMonth(i.date);
      if (!incomeYm) return false;
      // Include if the recurring income started in this month or earlier
      return (incomeYm.year < y) || (incomeYm.year === y && incomeYm.month <= m);
    }
    // For non-recurring income, only include if it's in this month
    return inMonth(i.date);
  });
  
  return { periodIncome, periodExpenses };
}

function computeTotals(expenses = [], income = []) {
  // Match Grilla: sumar montos crudos (sin valor absoluto)
  const totalExpenses = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const totalIncome = income.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  return {
    totalExpenses,
    totalIncome,
    balance: totalIncome - totalExpenses,
  };
}



