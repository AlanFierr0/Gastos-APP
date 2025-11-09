import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { formatMoneyNoDecimals, formatNumber, capitalizeWords, extractYearMonth } from '../utils/format.js';

function formatMonthYearLabel(year, month) {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return monthNames[month - 1];
}

export default function Forecast() {
  const { expenses, income, categories, addExpense, addIncome, t } = useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null); // Category key that is expanded
  const [editingDetail, setEditingDetail] = useState(null); // { conceptKey, month, gridType, value }
  const inputRef = useRef(null);
  const lastEditingKeyRef = useRef(null);
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

  // Get December values from current year - group by concept (category + concept) with expenseType
  const decemberValues = useMemo(() => {
    const values = {
      expenses: new Map(), // conceptKey (category::concept) -> { amount, expenseType }
      income: new Map(),   // conceptKey (category::concept) -> { amount }
    };

    // Process expenses from December of current year
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (!ym || ym.year !== currentYear || ym.month !== 12) return;
      
      const categoryName = e.category?.name || '';
      const conceptName = e.concept || '';
      const conceptKey = `${categoryName}::${conceptName}`;
      const expenseType = e.expenseType || 'MENSUAL'; // Get expenseType from expense, default to MENSUAL
      
      const current = values.expenses.get(conceptKey);
      const currentAmount = current?.amount || 0;
      values.expenses.set(conceptKey, { 
        amount: currentAmount + Number(e.amount || 0),
        expenseType,
        categoryName,
        conceptName
      });
    });

    // Process income from December of current year - group by category::concept
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (!ym || ym.year !== currentYear || ym.month !== 12) return;
      
      const categoryName = i.category?.name || i.categoryName || t('incomeGeneric') || 'Ingreso';
      const conceptName = i.concept || i.note || categoryName;
      const conceptKey = `${categoryName}::${conceptName}`;
      
      const current = values.income.get(conceptKey);
      const currentAmount = current?.amount || 0;
      values.income.set(conceptKey, { 
        amount: currentAmount + Number(i.amount || 0),
        categoryName,
        conceptName
      });
    });

    return values;
  }, [expenses, income, currentYear, t, categories]);

  // Forecast values state - can be edited
  const [forecastValuesState, setForecastValuesState] = useState({
    expenses: new Map(),
    income: new Map(),
  });

  // Calculate forecast values based on December + accumulated inflation + expense type
  const forecastValuesCalculated = useMemo(() => {
    const values = {
      expenses: new Map(),
      income: new Map(),
    };

    // Process expenses based on expense type - grouped by concept (category::concept)
    decemberValues.expenses.forEach(({ amount, expenseType, categoryName, conceptName }, conceptKey) => {
      if (!values.expenses.has(conceptKey)) {
        values.expenses.set(conceptKey, new Map());
      }
      
      if (expenseType === 'MENSUAL') {
        // Mensual: todos los meses iguales con inflación acumulada
        let accumulatedInflation = 0;
        for (let month = 1; month <= 12; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
          const multiplier = 1 + (accumulatedInflation / 100);
          values.expenses.get(conceptKey).set(month, amount * multiplier);
        }
      } else if (expenseType === 'SEMESTRAL') {
        // Semestral: aparece en junio (mes 6) y diciembre (mes 12) con inflación acumulada hasta cada mes
        // June (month 6)
        let accumulatedInflation = 0;
        for (let month = 1; month <= 6; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
        }
        const multiplier6 = 1 + (accumulatedInflation / 100);
        values.expenses.get(conceptKey).set(6, amount * multiplier6);
        
        // December (month 12)
        accumulatedInflation = 0;
        for (let month = 1; month <= 12; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
        }
        const multiplier12 = 1 + (accumulatedInflation / 100);
        values.expenses.get(conceptKey).set(12, amount * multiplier12);
      } else if (expenseType === 'ANUAL') {
        // Anual: solo en diciembre del año próximo (mes 12) con inflación acumulada hasta diciembre
        let accumulatedInflation = 0;
        for (let month = 1; month <= 12; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
        }
        const multiplier = 1 + (accumulatedInflation / 100);
        // Only set value for month 12 (December)
        values.expenses.get(conceptKey).set(12, amount * multiplier);
      } else if (expenseType === 'EXCEPCIONAL') {
        // Excepcional: dividir el total anual entre 12 meses (promedio mensual)
        const monthlyAmount = amount / 12;
        let accumulatedInflation = 0;
        for (let month = 1; month <= 12; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
          const multiplier = 1 + (accumulatedInflation / 100);
          values.expenses.get(conceptKey).set(month, monthlyAmount * multiplier);
        }
      } else {
        // Default: MENSUAL behavior
        let accumulatedInflation = 0;
        for (let month = 1; month <= 12; month++) {
          accumulatedInflation += expenseInflationRates[month] || 0;
          const multiplier = 1 + (accumulatedInflation / 100);
          values.expenses.get(conceptKey).set(month, amount * multiplier);
        }
      }
    });

    // Calculate accumulated inflation for income - grouped by concept (category::concept)
    let accumulatedIncomeInflation = 0;
    for (let month = 1; month <= 12; month++) {
      accumulatedIncomeInflation += incomeInflationRates[month] || 0;
      const incomeMultiplier = 1 + (accumulatedIncomeInflation / 100);

      // Apply to income - grouped by conceptKey
      decemberValues.income.forEach(({ amount }, conceptKey) => {
        if (!values.income.has(conceptKey)) {
          values.income.set(conceptKey, new Map());
        }
        values.income.get(conceptKey).set(month, amount * incomeMultiplier);
      });
    }

    return values;
  }, [decemberValues, expenseInflationRates, incomeInflationRates]);

  // Use calculated values if state is empty, otherwise use state (for edited values)
  const forecastValues = useMemo(() => {
    // If state is empty, use calculated values
    if (forecastValuesState.expenses.size === 0 && forecastValuesState.income.size === 0) {
      return forecastValuesCalculated;
    }
    
    // Merge calculated and edited values
    const merged = {
      expenses: new Map(forecastValuesCalculated.expenses),
      income: new Map(forecastValuesCalculated.income),
    };
    
    // Override with edited values
    forecastValuesState.expenses.forEach((monthMap, conceptKey) => {
      merged.expenses.set(conceptKey, new Map(monthMap));
    });
    forecastValuesState.income.forEach((monthMap, conceptKey) => {
      merged.income.set(conceptKey, new Map(monthMap));
    });
    
    return merged;
  }, [forecastValuesCalculated, forecastValuesState]);

  // Build grid data for expenses - only categories (concepts shown when expanded)
  const expensesGridData = useMemo(() => {
    // Group by category first
    const categoryMap = new Map();
    
    forecastValues.expenses.forEach((monthMap, conceptKey) => {
      const [categoryName, conceptName] = conceptKey.includes('::') 
        ? conceptKey.split('::')
        : [conceptKey, conceptKey];
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, []);
      }
      categoryMap.get(categoryName).push({
        conceptKey,
        conceptName,
        monthMap
      });
    });
    
    // Return only category rows (concepts will be shown when expanded)
    const sortedCategories = Array.from(categoryMap.keys()).sort();
    
    return sortedCategories.map(categoryName => {
      const concepts = categoryMap.get(categoryName).sort((a, b) => 
        a.conceptName.localeCompare(b.conceptName)
      );
      
      return {
        key: categoryName,
        type: 'expense',
        concepts: concepts.map(c => ({
          conceptKey: c.conceptKey,
          conceptName: c.conceptName,
          monthMap: c.monthMap
        }))
      };
    });
  }, [forecastValues.expenses]);

  // Build grid data for income - grouped by category, then by concept
  const incomeGridData = useMemo(() => {
    // Group by category first
    const categoryMap = new Map();
    
    forecastValues.income.forEach((monthMap, conceptKey) => {
      const [categoryName, conceptName] = conceptKey.includes('::') 
        ? conceptKey.split('::')
        : [conceptKey, conceptKey];
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, []);
      }
      categoryMap.get(categoryName).push({
        conceptKey,
        conceptName,
        monthMap
      });
    });
    
    // Return only category rows (concepts will be shown when expanded)
    const sortedCategories = Array.from(categoryMap.keys()).sort();
    
    return sortedCategories.map(categoryName => {
      const concepts = categoryMap.get(categoryName).sort((a, b) => 
        a.conceptName.localeCompare(b.conceptName)
      );
      
      return {
        key: categoryName,
        type: 'income',
        concepts: concepts.map(c => ({
          conceptKey: c.conceptKey,
          conceptName: c.conceptName,
          monthMap: c.monthMap
        }))
      };
    });
  }, [forecastValues.income]);

  // Calculate totals
  const expensesRowTotals = useMemo(() => {
    const totals = new Map();
    expensesGridData.forEach((row) => {
      // For category rows, sum all concepts in that category
      let total = 0;
      row.concepts.forEach(({ conceptKey }) => {
        for (let month = 1; month <= 12; month++) {
          const value = forecastValues.expenses.get(conceptKey)?.get(month) || 0;
          total += value;
        }
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [expensesGridData, forecastValues.expenses]);

  const expensesMonthTotals = useMemo(() => {
    const totals = new Map();
    for (let month = 1; month <= 12; month++) {
      let total = 0;
      // Sum all concepts from all categories
      expensesGridData.forEach((row) => {
        row.concepts.forEach(({ conceptKey }) => {
          const value = forecastValues.expenses.get(conceptKey)?.get(month) || 0;
          total += value;
        });
      });
      totals.set(month, total);
    }
    return totals;
  }, [expensesGridData, forecastValues.expenses]);

  const incomeRowTotals = useMemo(() => {
    const totals = new Map();
    incomeGridData.forEach((row) => {
      // For category rows, sum all concepts in that category
      let total = 0;
      row.concepts.forEach(({ conceptKey }) => {
        for (let month = 1; month <= 12; month++) {
          const value = forecastValues.income.get(conceptKey)?.get(month) || 0;
          total += value;
        }
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [incomeGridData, forecastValues.income]);

  const incomeMonthTotals = useMemo(() => {
    const totals = new Map();
    for (let month = 1; month <= 12; month++) {
      let total = 0;
      // Sum all concepts from all categories
      incomeGridData.forEach((row) => {
        row.concepts.forEach(({ conceptKey }) => {
          const value = forecastValues.income.get(conceptKey)?.get(month) || 0;
          total += value;
        });
      });
      totals.set(month, total);
    }
    return totals;
  }, [incomeGridData, forecastValues.income]);

  // Calculate last year totals by category/concept
  const lastYearRowTotals = useMemo(() => {
    const totals = {
      expenses: new Map(),
      income: new Map(),
    };

    // Process expenses from current year (all months, not just December)
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (!ym || ym.year !== currentYear) return;
      
      const categoryName = e.category?.name || '';
      const conceptName = e.concept || '';
      const conceptKey = `${categoryName}::${conceptName}`;
      
      const current = totals.expenses.get(conceptKey) || 0;
      totals.expenses.set(conceptKey, current + Number(e.amount || 0));
    });

    // Process income from current year (all months)
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (!ym || ym.year !== currentYear) return;
      
      const categoryName = i.category?.name || i.categoryName || t('incomeGeneric') || 'Ingreso';
      const conceptName = i.concept || i.note || categoryName;
      const conceptKey = `${categoryName}::${conceptName}`;
      
      const current = totals.income.get(conceptKey) || 0;
      totals.income.set(conceptKey, current + Number(i.amount || 0));
    });

    // Now aggregate by category (row key) for expenses
    const expensesCategoryTotals = new Map();
    expensesGridData.forEach((row) => {
      let categoryTotal = 0;
      row.concepts.forEach(({ conceptKey }) => {
        categoryTotal += totals.expenses.get(conceptKey) || 0;
      });
      expensesCategoryTotals.set(row.key, categoryTotal);
    });

    // Now aggregate by category (row key) for income
    const incomeCategoryTotals = new Map();
    incomeGridData.forEach((row) => {
      let categoryTotal = 0;
      row.concepts.forEach(({ conceptKey }) => {
        categoryTotal += totals.income.get(conceptKey) || 0;
      });
      incomeCategoryTotals.set(row.key, categoryTotal);
    });

    return {
      expenses: expensesCategoryTotals,
      income: incomeCategoryTotals,
    };
  }, [expenses, income, currentYear, expensesGridData, incomeGridData, t]);

  const handleDetailDoubleClick = (conceptKey, month, gridType) => {
    const values = gridType === 'expense' ? forecastValues.expenses : forecastValues.income;
    const currentValue = values.get(conceptKey)?.get(month) || 0;
    setEditingDetail({ conceptKey, month, gridType, value: currentValue > 0 ? String(Math.round(currentValue)) : '' });
  };

  const handleDetailSave = () => {
    if (!editingDetail) return;
    
    const { conceptKey, month, gridType, value } = editingDetail;
    
    try {
      const numValue = parseFloat(String(value).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue) || numValue < 0) {
        setEditingDetail(null);
        return;
      }

      // Update forecastValuesState
      setForecastValuesState(prev => {
        const newState = {
          expenses: new Map(prev.expenses),
          income: new Map(prev.income),
        };
        
        const targetMap = gridType === 'expense' ? newState.expenses : newState.income;
        const calculatedMap = gridType === 'expense' ? forecastValuesCalculated.expenses : forecastValuesCalculated.income;
        
        if (!targetMap.has(conceptKey)) {
          // Copy all months from calculated values to preserve them
          const calculatedMonthMap = calculatedMap.get(conceptKey);
          if (calculatedMonthMap) {
            targetMap.set(conceptKey, new Map(calculatedMonthMap));
          } else {
            targetMap.set(conceptKey, new Map());
          }
        }
        
        // Get the monthMap and create a new copy to avoid mutating
        const existingMonthMap = targetMap.get(conceptKey);
        const monthMap = new Map(existingMonthMap);
        
        if (numValue > 0) {
          // Set the edited month
          monthMap.set(month, numValue);
          
          // Update all future months (months after the edited one) to the same value
          for (let futureMonth = month + 1; futureMonth <= 12; futureMonth++) {
            monthMap.set(futureMonth, numValue);
          }
        } else {
          monthMap.delete(month);
          // Also delete future months if value is 0
          for (let futureMonth = month + 1; futureMonth <= 12; futureMonth++) {
            monthMap.delete(futureMonth);
          }
        }
        
        // Update the map with the new monthMap
        targetMap.set(conceptKey, monthMap);
        
        return newState;
      });
    } catch (error) {
      console.error('Error saving detail:', error);
    } finally {
      setEditingDetail(null);
    }
  };

  useEffect(() => {
    if (editingDetail && inputRef.current) {
      // Create a unique key for this editing session
      const editingKey = editingDetail 
        ? `${editingDetail.gridType}-${editingDetail.conceptKey}-${editingDetail.month}`
        : null;
      
      // Only select text if this is a new editing session
      if (editingKey && editingKey !== lastEditingKeyRef.current) {
        lastEditingKeyRef.current = editingKey;
        inputRef.current.focus();
        // Use setTimeout to ensure the input is fully rendered
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.select();
          }
        }, 0);
      } else {
        // Just focus, don't select (user is already typing)
        inputRef.current.focus();
      }
    } else {
      // Reset when editing stops
      lastEditingKeyRef.current = null;
    }
  }, [editingDetail]);

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
      // Save expenses - parse conceptKey to get category and concept
      for (const [conceptKey, monthMap] of forecastValues.expenses.entries()) {
        const [categoryName, conceptName] = conceptKey.includes('::') 
          ? conceptKey.split('::')
          : [conceptKey, conceptKey];
        const categoryObj = categories?.find(c => c.name?.toLowerCase() === categoryName.toLowerCase());
        
        // Get expenseType from the original expense in decemberValues
        const decemberData = decemberValues.expenses.get(conceptKey);
        const expenseType = decemberData?.expenseType || 'MENSUAL';
        
        for (let month = 1; month <= 12; month++) {
          const amount = monthMap.get(month);
          if (amount && amount > 0) {
            const date = new Date(Date.UTC(forecastYear, month - 1, 1, 12, 0, 0, 0)).toISOString();
            
            await addExpense({
              categoryId: categoryObj?.id,
              categoryName: categoryName.toLowerCase(),
              concept: conceptName,
              amount: amount,
              date: date,
              note: `Forecast ${forecastYear}`,
              currency: 'ARS',
              expenseType: expenseType,
            });
          }
        }
      }

      // Save income - parse conceptKey to get category and concept
      for (const [conceptKey, monthMap] of forecastValues.income.entries()) {
        const [categoryName, conceptName] = conceptKey.includes('::') 
          ? conceptKey.split('::')
          : [conceptKey, conceptKey];
        const categoryObj = categories?.find(c => c.name?.toLowerCase() === categoryName.toLowerCase());
        
        for (let month = 1; month <= 12; month++) {
          const amount = monthMap.get(month);
          if (amount && amount > 0) {
            const date = new Date(Date.UTC(forecastYear, month - 1, 1, 12, 0, 0, 0)).toISOString();
            
            await addIncome({
              categoryId: categoryObj?.id,
              categoryName: categoryName.toLowerCase(),
              concept: conceptName,
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

  const renderCell = (row, month, gridType) => {
    const values = gridType === 'expense' ? forecastValues.expenses : forecastValues.income;
    
    // For both expenses and income, sum all concepts in that category for this month
    let total = 0;
    row.concepts.forEach(({ conceptKey }) => {
      const value = values.get(conceptKey)?.get(month) || 0;
      total += value;
    });
    const displayValue = total !== 0 ? formatMoneyNoDecimals(total, 'ARS', { sign: 'auto' }) : '-';
    return (
      <div className="px-1 py-0.5 text-sm text-center overflow-hidden text-ellipsis whitespace-nowrap" style={{ minHeight: '20px', maxWidth: '100%' }}>
        {displayValue}
      </div>
    );
  };

  const renderGrid = (gridData, rowTotals, monthTotals, gridType, title) => {
    const lastYearTotals = gridType === 'expense' ? lastYearRowTotals.expenses : lastYearRowTotals.income;
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
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">Total {currentYear}</span>
                </th>
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">Diferencia %</span>
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
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">Total {currentYear}</span>
                </th>
                <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 overflow-hidden" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  <span className="inline-block truncate w-full">Diferencia %</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {gridData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t('noData') || 'No hay datos de diciembre para calcular el forecast'}
                  </td>
                </tr>
              ) : (
                gridData.map((row) => {
                  const expandedKey = `${gridType}-${row.key}`;
                  const isExpanded = expandedCategory === expandedKey;
                  
                  return (
                    <React.Fragment key={row.key}>
                      <tr className="border-b-2 border-gray-300 dark:border-gray-600 hover:bg-amber-50/50 dark:hover:bg-amber-900/20">
                        <td
                          className="sticky left-0 border-r-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-xs bg-white dark:bg-gray-900 z-10 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 overflow-hidden"
                          style={{ width: 100, minWidth: 100, maxWidth: 100 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCategory(isExpanded ? null : expandedKey);
                          }}
                        >
                          <div className="relative flex items-center justify-center overflow-hidden" style={{ paddingLeft: '1rem' }}>
                            <span className="material-symbols-outlined text-xs absolute left-0 flex-shrink-0" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                              chevron_right
                            </span>
                            <span className="truncate text-center flex-1 min-w-0">{capitalizeWords(row.key)}</span>
                          </div>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                          <td
                            key={month}
                            className="border-r-2 border-gray-300 dark:border-gray-600 p-0 text-center overflow-hidden"
                            style={{ width: 85, minWidth: 85, maxWidth: 85 }}
                          >
                            {renderCell(row, month, gridType)}
                          </td>
                        ))}
                        <td className="border-l-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                          {formatMoneyNoDecimals(rowTotals.get(row.key) || 0, 'ARS', { sign: 'auto' })}
                        </td>
                        <td className="border-l-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                          {formatMoneyNoDecimals(lastYearTotals.get(row.key) || 0, 'ARS', { sign: 'auto' })}
                        </td>
                        <td className="border-l-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                          {(() => {
                            const forecastTotal = rowTotals.get(row.key) || 0;
                            const lastYearTotal = lastYearTotals.get(row.key) || 0;
                            if (lastYearTotal === 0) return '-';
                            const diffPercent = ((forecastTotal - lastYearTotal) / lastYearTotal) * 100;
                            const colorClass = diffPercent >= 0 ? 'text-green-600' : 'text-red-600';
                            return (
                              <span className={colorClass}>
                                {diffPercent >= 0 ? '+' : ''}{formatNumber(diffPercent, 2)}%
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                        {isExpanded && (
                        <tr>
                          <td colSpan={16} className="border border-gray-200 dark:border-gray-700 p-0 bg-gray-50 dark:bg-gray-800/50">
                            <div className="p-4">
                              <h4 className="font-semibold text-sm mb-3">{t('details') || 'Detalles'} - {capitalizeWords(row.key)}</h4>
                              <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg">
                                <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                                  <thead className="bg-indigo-100 dark:bg-indigo-900/40">
                                    <tr>
                                      <th className="sticky left-0 border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40 z-20" style={{ width: 100, minWidth: 100 }}>
                                        {t('concept') || 'Concepto'}
                                      </th>
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                                        <th
                                          key={month}
                                          className="border-2 border-indigo-300 dark:border-indigo-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40"
                                          style={{ width: 85, minWidth: 85 }}
                                          title={`${formatMonthYearLabel(forecastYear, month)} ${forecastYear}`}
                                        >
                                          {formatMonthYearLabel(forecastYear, month)}
                                        </th>
                                      ))}
                                      <th className="border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40" style={{ width: 90, minWidth: 90 }}>
                                        {t('total') || 'Total'}
                                      </th>
                                      <th className="border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40" style={{ width: 90, minWidth: 90 }}>
                                        Total {currentYear}
                                      </th>
                                      <th className="border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40" style={{ width: 90, minWidth: 90 }}>
                                        Diferencia %
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.concepts.map(({ conceptKey, conceptName }, idx) => {
                                      // Calculate total for this concept
                                      const values = gridType === 'expense' ? forecastValues.expenses : forecastValues.income;
                                      let conceptTotal = 0;
                                      for (let month = 1; month <= 12; month++) {
                                        const value = values.get(conceptKey)?.get(month) || 0;
                                        conceptTotal += value;
                                      }
                                      
                                      // Calculate last year total for this concept
                                      const conceptLastYearTotal = (() => {
                                        // We need to get the total from all expenses/income with this conceptKey from current year
                                        let total = 0;
                                        const data = gridType === 'expense' ? expenses : income;
                                        (data || []).forEach((item) => {
                                          const ym = extractYearMonth(item.date);
                                          if (!ym || ym.year !== currentYear) return;
                                          
                                          const categoryName = item.category?.name || (gridType === 'expense' ? '' : (item.categoryName || t('incomeGeneric') || 'Ingreso'));
                                          const itemConceptName = item.concept || (gridType === 'expense' ? '' : (item.note || categoryName));
                                          const itemConceptKey = `${categoryName}::${itemConceptName}`;
                                          
                                          if (itemConceptKey === conceptKey) {
                                            total += Number(item.amount || 0);
                                          }
                                        });
                                        return total;
                                      })();
                                      
                                      return (
                                        <tr key={`concept-${idx}`} className="border-b-2 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                                          <td className="sticky left-0 border-r-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-xs text-center bg-white dark:bg-gray-900 z-10" style={{ width: 100, minWidth: 100 }}>
                                            <div className="flex items-center justify-center gap-1">
                                              <span className="truncate">{capitalizeWords(conceptName)}</span>
                                            </div>
                                          </td>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                                            const isEditing = editingDetail?.conceptKey === conceptKey && editingDetail?.month === month && editingDetail?.gridType === gridType;
                                            
                                            if (isEditing) {
                                              return (
                                                <td
                                                  key={month}
                                                  className="border-r-2 border-indigo-300 dark:border-indigo-600 p-0 bg-white dark:bg-gray-900"
                                                  style={{ width: 85, minWidth: 85 }}
                                                >
                                                  <input
                                                    ref={inputRef}
                                                    type="number"
                                                    step="0.01"
                                                    value={editingDetail.value}
                                                    onChange={(e) => setEditingDetail({ ...editingDetail, value: e.target.value })}
                                                    onBlur={handleDetailSave}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleDetailSave();
                                                      } else if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        setEditingDetail(null);
                                                      }
                                                    }}
                                                    className="w-full h-full px-1 py-0.5 border-2 border-blue-500 bg-white dark:bg-gray-800 text-xs focus:outline-none text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                    style={{ minWidth: '85px' }}
                                                  />
                                                </td>
                                              );
                                            }
                                            
                                            const value = values.get(conceptKey)?.get(month) || 0;
                                            const displayValue = value !== 0 ? formatMoneyNoDecimals(value, 'ARS', { sign: 'auto' }) : '-';
                                            return (
                                              <td
                                                key={month}
                                                className="border-r-2 border-indigo-300 dark:border-indigo-600 px-1 py-1 text-xs text-center bg-white dark:bg-gray-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-cell"
                                                style={{ width: 85, minWidth: 85 }}
                                                onDoubleClick={() => handleDetailDoubleClick(conceptKey, month, gridType)}
                                                title={t('doubleClickToEdit') || 'Doble click para editar'}
                                              >
                                                {displayValue}
                                              </td>
                                            );
                                          })}
                                          <td className="border-l-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-xs text-center font-semibold bg-white dark:bg-gray-900" style={{ width: 90, minWidth: 90 }}>
                                            {formatMoneyNoDecimals(conceptTotal, 'ARS', { sign: 'auto' })}
                                          </td>
                                          <td className="border-l-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-xs text-center font-semibold bg-white dark:bg-gray-900" style={{ width: 90, minWidth: 90 }}>
                                            {formatMoneyNoDecimals(conceptLastYearTotal, 'ARS', { sign: 'auto' })}
                                          </td>
                                          <td className="border-l-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-xs text-center font-semibold bg-white dark:bg-gray-900" style={{ width: 90, minWidth: 90 }}>
                                            {(() => {
                                              if (conceptLastYearTotal === 0) return '-';
                                              const diffPercent = ((conceptTotal - conceptLastYearTotal) / conceptLastYearTotal) * 100;
                                              const colorClass = diffPercent >= 0 ? 'text-green-600' : 'text-red-600';
                                              return (
                                                <span className={colorClass}>
                                                  {diffPercent >= 0 ? '+' : ''}{formatNumber(diffPercent, 2)}%
                                                </span>
                                              );
                                            })()}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
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
                <td className="border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  {formatMoneyNoDecimals(Array.from(lastYearTotals.values()).reduce((sum, val) => sum + val, 0), 'ARS', { sign: 'auto' })}
                </td>
                <td className="border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 95, minWidth: 95, maxWidth: 95 }}>
                  {(() => {
                    const forecastGrandTotal = Array.from(monthTotals.values()).reduce((sum, val) => sum + val, 0);
                    const lastYearGrandTotal = Array.from(lastYearTotals.values()).reduce((sum, val) => sum + val, 0);
                    if (lastYearGrandTotal === 0) return '-';
                    const diffPercent = ((forecastGrandTotal - lastYearGrandTotal) / lastYearGrandTotal) * 100;
                    const colorClass = diffPercent >= 0 ? 'text-green-600' : 'text-red-600';
                    return (
                      <span className={colorClass}>
                        {diffPercent >= 0 ? '+' : ''}{formatNumber(diffPercent, 2)}%
                      </span>
                    );
                  })()}
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

