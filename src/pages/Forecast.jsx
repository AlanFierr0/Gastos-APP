import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { formatMoneyNoDecimals, capitalizeWords } from '../utils/format.js';

function extractYearMonth(dateStr) {
  if (!dateStr) return null;
  let str = dateStr instanceof Date ? dateStr.toISOString() : String(dateStr).trim();
  let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return { year: Number(m[3]), month: Number(m[2]) };
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function formatMonthYearLabel(year, month) {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return monthNames[month - 1];
}

export default function Forecast() {
  const { expenses, income, categories, addExpense, addIncome, t } = useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  // Separate inflation rates for expenses and income
  const [expenseInflationRates, setExpenseInflationRates] = useState(() => {
    const rates = {};
    for (let i = 1; i <= 12; i++) {
      rates[i] = 0;
    }
    return rates;
  });
  const [incomeInflationRates, setIncomeInflationRates] = useState(() => {
    const rates = {};
    for (let i = 1; i <= 12; i++) {
      rates[i] = 0;
    }
    return rates;
  });
  // Store raw input values (with commas) separately from numeric values
  const [expenseInflationInputs, setExpenseInflationInputs] = useState(() => {
    const inputs = {};
    for (let i = 1; i <= 12; i++) {
      inputs[i] = '';
    }
    return inputs;
  });
  const [incomeInflationInputs, setIncomeInflationInputs] = useState(() => {
    const inputs = {};
    for (let i = 1; i <= 12; i++) {
      inputs[i] = '';
    }
    return inputs;
  });
  const expenseInputRefs = useRef({});
  const incomeInputRefs = useRef({});

  const currentYear = new Date().getFullYear();
  const forecastYear = currentYear + 1;

  // Get December values from current year
  const decemberValues = useMemo(() => {
    const values = {
      expenses: new Map(), // category -> amount
      income: new Map(),   // category -> amount
    };

    // Process expenses from December of current year
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (!ym || ym.year !== currentYear || ym.month !== 12) return;
      
      const categoryKey = e.category?.name || e.concept || e.note || t('expenseGeneric') || 'Gasto';
      const current = values.expenses.get(categoryKey) || 0;
      values.expenses.set(categoryKey, current + Number(e.amount || 0));
    });

    // Process income from December of current year
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (!ym || ym.year !== currentYear || ym.month !== 12) return;
      
      const categoryKey = i.category?.name || i.categoryName || t('incomeGeneric') || 'Ingreso';
      const current = values.income.get(categoryKey) || 0;
      values.income.set(categoryKey, current + Number(i.amount || 0));
    });

    return values;
  }, [expenses, income, currentYear, t]);

  // Calculate forecast values based on December + accumulated inflation
  const forecastValues = useMemo(() => {
    const values = {
      expenses: new Map(),
      income: new Map(),
    };

    // Calculate accumulated inflation for expenses
    let accumulatedExpenseInflation = 0;
    for (let month = 1; month <= 12; month++) {
      accumulatedExpenseInflation += expenseInflationRates[month] || 0;
      const expenseMultiplier = 1 + (accumulatedExpenseInflation / 100);

      // Apply to expenses
      decemberValues.expenses.forEach((amount, category) => {
        if (!values.expenses.has(category)) {
          values.expenses.set(category, new Map());
        }
        values.expenses.get(category).set(month, amount * expenseMultiplier);
      });
    }

    // Calculate accumulated inflation for income
    let accumulatedIncomeInflation = 0;
    for (let month = 1; month <= 12; month++) {
      accumulatedIncomeInflation += incomeInflationRates[month] || 0;
      const incomeMultiplier = 1 + (accumulatedIncomeInflation / 100);

      // Apply to income
      decemberValues.income.forEach((amount, category) => {
        if (!values.income.has(category)) {
          values.income.set(category, new Map());
        }
        values.income.get(category).set(month, amount * incomeMultiplier);
      });
    }

    return values;
  }, [decemberValues, expenseInflationRates, incomeInflationRates]);

  // Build grid data for expenses
  const expensesGridData = useMemo(() => {
    const categories = Array.from(forecastValues.expenses.keys()).sort();
    return categories.map(category => ({
      key: category,
      type: 'expense',
    }));
  }, [forecastValues.expenses]);

  // Build grid data for income
  const incomeGridData = useMemo(() => {
    const categories = Array.from(forecastValues.income.keys()).sort();
    return categories.map(category => ({
      key: category,
      type: 'income',
    }));
  }, [forecastValues.income]);

  // Calculate totals
  const expensesRowTotals = useMemo(() => {
    const totals = new Map();
    expensesGridData.forEach((row) => {
      let total = 0;
      for (let month = 1; month <= 12; month++) {
        const value = forecastValues.expenses.get(row.key)?.get(month) || 0;
        total += value;
      }
      totals.set(row.key, total);
    });
    return totals;
  }, [expensesGridData, forecastValues.expenses]);

  const expensesMonthTotals = useMemo(() => {
    const totals = new Map();
    for (let month = 1; month <= 12; month++) {
      let total = 0;
      expensesGridData.forEach((row) => {
        const value = forecastValues.expenses.get(row.key)?.get(month) || 0;
        total += value;
      });
      totals.set(month, total);
    }
    return totals;
  }, [expensesGridData, forecastValues.expenses]);

  const incomeRowTotals = useMemo(() => {
    const totals = new Map();
    incomeGridData.forEach((row) => {
      let total = 0;
      for (let month = 1; month <= 12; month++) {
        const value = forecastValues.income.get(row.key)?.get(month) || 0;
        total += value;
      }
      totals.set(row.key, total);
    });
    return totals;
  }, [incomeGridData, forecastValues.income]);

  const incomeMonthTotals = useMemo(() => {
    const totals = new Map();
    for (let month = 1; month <= 12; month++) {
      let total = 0;
      incomeGridData.forEach((row) => {
        const value = forecastValues.income.get(row.key)?.get(month) || 0;
        total += value;
      });
      totals.set(month, total);
    }
    return totals;
  }, [incomeGridData, forecastValues.income]);

  const handleInflationChange = (month, value, type) => {
    // Store the raw input value (with comma) for display
    if (type === 'expense') {
      setExpenseInflationInputs(prev => ({
        ...prev,
        [month]: value,
      }));
      
      // Also update the numeric value for calculations (convert comma to dot)
      const normalizedValue = String(value || '').replace(',', '.');
      const numValue = parseFloat(normalizedValue);
      if (!isNaN(numValue)) {
        setExpenseInflationRates(prev => ({
          ...prev,
          [month]: numValue,
        }));
      } else if (value === '' || value === '-') {
        // Allow empty or just minus sign
        setExpenseInflationRates(prev => ({
          ...prev,
          [month]: 0,
        }));
      }
    } else {
      setIncomeInflationInputs(prev => ({
        ...prev,
        [month]: value,
      }));
      
      // Also update the numeric value for calculations (convert comma to dot)
      const normalizedValue = String(value || '').replace(',', '.');
      const numValue = parseFloat(normalizedValue);
      if (!isNaN(numValue)) {
        setIncomeInflationRates(prev => ({
          ...prev,
          [month]: numValue,
        }));
      } else if (value === '' || value === '-') {
        // Allow empty or just minus sign
        setIncomeInflationRates(prev => ({
          ...prev,
          [month]: 0,
        }));
      }
    }
  };

  const handleSaveForecast = async () => {
    setSaving(true);
    try {
      // Save expenses
      for (const [category, monthMap] of forecastValues.expenses.entries()) {
        for (let month = 1; month <= 12; month++) {
          const amount = monthMap.get(month);
          if (amount && amount > 0) {
            const date = new Date(Date.UTC(forecastYear, month - 1, 1, 12, 0, 0, 0)).toISOString();
            const categoryName = category.toLowerCase();
            const categoryObj = categories?.find(c => c.name?.toLowerCase() === categoryName);
            
            await addExpense({
              categoryId: categoryObj?.id,
              categoryName: categoryName,
              concept: category,
              amount: amount,
              date: date,
              note: `Forecast ${forecastYear}`,
              currency: 'ARS',
            });
          }
        }
      }

      // Save income
      for (const [category, monthMap] of forecastValues.income.entries()) {
        for (let month = 1; month <= 12; month++) {
          const amount = monthMap.get(month);
          if (amount && amount > 0) {
            const date = new Date(Date.UTC(forecastYear, month - 1, 1, 12, 0, 0, 0)).toISOString();
            const categoryName = category.toLowerCase();
            const categoryObj = categories?.find(c => c.name?.toLowerCase() === categoryName);
            
            await addIncome({
              categoryId: categoryObj?.id,
              categoryName: categoryName,
              concept: category,
              amount: amount,
              date: date,
              note: `Forecast ${forecastYear}`,
              currency: 'ARS',
              isRecurring: false,
            });
          }
        }
      }

      // Navigate to grid after saving
      navigate('/grid');
    } catch (error) {
      console.error('Error saving forecast:', error);
      alert('Error al guardar el forecast. Por favor, intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (category, month, gridType) => {
    const values = gridType === 'expense' ? forecastValues.expenses : forecastValues.income;
    const amount = values.get(category)?.get(month) || 0;
    const displayValue = amount !== 0 ? formatMoneyNoDecimals(amount, 'ARS', { sign: 'auto' }) : '-';
    
    return (
      <div className="px-1 py-0.5 text-sm text-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ minHeight: '20px', maxWidth: '100%' }}>
        {displayValue}
      </div>
    );
  };

  const renderGrid = (gridData, rowTotals, monthTotals, gridType, title) => {
    return (
      <div className="mb-8">
        <div className="mb-2">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <div className="border-2 border-gray-400 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 bg-blue-50 dark:bg-blue-900/20 z-10">
              {/* Inflation row */}
              <tr>
                <th className="sticky left-0 border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 z-20 overflow-hidden" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                  <span className="inline-block truncate w-full">{t('inflation') || 'Inflación'}</span>
                </th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                  const inflationInputs = gridType === 'expense' ? expenseInflationInputs : incomeInflationInputs;
                  const inflationRates = gridType === 'expense' ? expenseInflationRates : incomeInflationRates;
                  const inputRefs = gridType === 'expense' ? expenseInputRefs : incomeInputRefs;
                  const setInflationRates = gridType === 'expense' ? setExpenseInflationRates : setIncomeInflationRates;
                  const setInflationInputs = gridType === 'expense' ? setExpenseInflationInputs : setIncomeInflationInputs;
                  
                  return (
                    <th
                      key={month}
                      className="border-2 border-blue-300 dark:border-blue-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden"
                      style={{ width: 85, minWidth: 85, maxWidth: 85 }}
                    >
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current[month] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        value={inflationInputs[month] !== undefined ? inflationInputs[month] : (inflationRates[month] ? String(inflationRates[month]).replace('.', ',') : '')}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          // Allow only numbers, comma, and minus sign
                          if (inputValue === '' || /^-?\d*[,]?\d*$/.test(inputValue)) {
                            handleInflationChange(month, inputValue, gridType);
                          }
                        }}
                        onBlur={(e) => {
                          // Normalize on blur: convert comma to dot and parse
                          const value = e.target.value.replace(',', '.');
                          const num = parseFloat(value);
                          if (!isNaN(num)) {
                            setInflationRates(prev => ({
                              ...prev,
                              [month]: num,
                            }));
                            // Update input to show normalized value with comma
                            setInflationInputs(prev => ({
                              ...prev,
                              [month]: String(num).replace('.', ','),
                            }));
                          } else {
                            setInflationRates(prev => ({
                              ...prev,
                              [month]: 0,
                            }));
                            setInflationInputs(prev => ({
                              ...prev,
                              [month]: '',
                            }));
                          }
                        }}
                        onFocus={() => {
                          // When focusing, if the value is 0, clear the input
                          if (inflationRates[month] === 0 && inflationInputs[month] === '') {
                            setInflationInputs(prev => ({
                              ...prev,
                              [month]: '',
                            }));
                          }
                        }}
                        className="w-full px-1 py-0.5 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-full"
                        placeholder="0"
                        style={{ maxWidth: '100%' }}
                      />
                    </th>
                  );
                })}
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">{t('total') || 'Total'}</span>
                </th>
              </tr>
              {/* Month labels row */}
              <tr>
                <th className="sticky left-0 border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 z-20 overflow-hidden" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                  <span className="inline-block truncate w-full">{t('category') || 'Categoría'}</span>
                </th>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <th
                    key={month}
                    className="border-2 border-blue-300 dark:border-blue-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden"
                    style={{ width: 85, minWidth: 85, maxWidth: 85 }}
                    title={`${formatMonthYearLabel(forecastYear, month)} ${forecastYear}`}
                  >
                    <span className="inline-block truncate w-full">{formatMonthYearLabel(forecastYear, month)}</span>
                  </th>
                ))}
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">{t('total') || 'Total'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gridData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('noData') || 'No hay datos de diciembre para calcular el forecast'}
                  </td>
                </tr>
              ) : (
                gridData.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b-2 border-gray-300 dark:border-gray-600 hover:bg-amber-50/50 dark:hover:bg-amber-900/20"
                  >
                    <td
                      className="sticky left-0 border-r-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-xs text-center bg-white dark:bg-gray-900 z-10 overflow-hidden"
                      style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                    >
                      <span className="inline-block truncate w-full">{capitalizeWords(row.key)}</span>
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                      <td
                        key={month}
                        className="border-r-2 border-gray-300 dark:border-gray-600 p-0 text-center overflow-hidden"
                        style={{ width: 85, minWidth: 85, maxWidth: 85 }}
                      >
                        {renderCell(row.key, month, gridType)}
                      </td>
                    ))}
                    <td className="border-l-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                      {formatMoneyNoDecimals(rowTotals.get(row.key) || 0, 'ARS', { sign: 'auto' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white dark:bg-gray-900 z-10">
              <tr>
                <td className="sticky left-0 border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-xs text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 z-20 overflow-hidden" style={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                  <span className="inline-block truncate w-full">{t('total') || 'Total'}</span>
                </td>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <td
                    key={month}
                    className="border-2 border-gray-400 dark:border-gray-600 px-1 py-1 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ width: 85, minWidth: 85, maxWidth: 85 }}
                  >
                    {formatMoneyNoDecimals(monthTotals.get(month) || 0, 'ARS', { sign: 'auto' })}
                  </td>
                ))}
                <td className="border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  {formatMoneyNoDecimals(Array.from(monthTotals.values()).reduce((sum, val) => sum + val, 0), 'ARS', { sign: 'auto' })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-4xl font-black tracking-[-0.033em]">{t('forecast') || 'Forecast'}</p>
            <p className="text-[#616f89] dark:text-gray-400">
              {(t('forecastSubtitle') || 'Pronóstico para {year} basado en diciembre {currentYear} + inflación acumulada')
                .replace('{year}', forecastYear)
                .replace('{currentYear}', currentYear)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveForecast}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (t('savingForecast') || 'Guardando...') : (t('saveForecast') || 'Guardar Forecast')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/grid')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('backToGrid') || 'Volver a Grilla'}
            </button>
          </div>
        </div>
      </div>

      {renderGrid(expensesGridData, expensesRowTotals, expensesMonthTotals, 'expense', t('expenses') || 'Gastos')}
      {renderGrid(incomeGridData, incomeRowTotals, incomeMonthTotals, 'income', t('income') || 'Ingresos')}
    </div>
  );
}

