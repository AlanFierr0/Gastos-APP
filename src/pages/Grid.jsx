import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { formatMoneyNoDecimals, capitalizeWords, extractYearMonth } from '../utils/format.js';
import CustomSelect from '../components/CustomSelect.jsx';

function isForecastMonth(monthKey) {
  // monthKey format: "YYYY-MM"
  const [year, month] = monthKey.split('-').map(Number);
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

function getLastPastMonthIndex(months) {
  for (let i = months.length - 1; i >= 0; i--) {
    if (!isForecastMonth(months[i])) {
      return i;
    }
  }
  return -1; // All months are forecast
}


function formatMonthYearLabel(year, month) {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  // Use shorter format: just month abbreviation if same year, or month + last 2 digits of year
  return monthNames[month - 1];
}

export default function Grid() {
  const { expenses, income, updateExpense, updateIncome, addExpense, addIncome, categories, t } = useApp();
  const navigate = useNavigate();
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedCategory, setExpandedCategory] = useState(null); // Category key that is expanded
  const [editingDetail, setEditingDetail] = useState(null); // { recordId, monthKey, gridType, value }
  const [selectedYear, setSelectedYear] = useState(null); // null = all years, or specific year number
  const [showForecast, setShowForecast] = useState(false); // Toggle para mostrar/ocultar forecast
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const lastEditingKeyRef = useRef(null);

  // Get all unique years
  const availableYears = useMemo(() => {
    const yearSet = new Set();
    
    // Process expenses
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (ym) yearSet.add(ym.year);
    });

    // Process income
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (ym) yearSet.add(ym.year);
    });

    // Sort years descending (most recent first)
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [expenses, income]);

  // Initialize selectedYear to the most recent year if not set
  useEffect(() => {
    if (selectedYear === null && availableYears.length > 0) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Get all unique months (filtered by selectedYear if set, and forecast if toggle is off)
  const months = useMemo(() => {
    const monthSet = new Set();
    
    // Process expenses
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (!ym) return;
      // Filter by year if selectedYear is set
      if (selectedYear !== null && ym.year !== selectedYear) return;
      const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      // Filter forecast months if toggle is off
      if (!showForecast && isForecastMonth(monthKey)) return;
      monthSet.add(monthKey);
    });

    // Process income
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (!ym) return;
      // Filter by year if selectedYear is set
      if (selectedYear !== null && ym.year !== selectedYear) return;
      const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      // Filter forecast months if toggle is off
      if (!showForecast && isForecastMonth(monthKey)) return;
      monthSet.add(monthKey);
    });

    // Sort months ascending (January first, December last)
    return Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  }, [expenses, income, selectedYear, showForecast]);

  // Process expenses data (filtered by selectedYear if set)
  const expensesGridData = useMemo(() => {
    const rowKeySet = new Map();
    
    // Process expenses - group by category name (fallback to concept/note)
    (expenses || []).forEach((e) => {
      const ym = extractYearMonth(e.date);
      if (!ym) return;
      // Filter by year if selectedYear is set
      if (selectedYear !== null && ym.year !== selectedYear) return;
      const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      
      const rowKey = e.category?.name || e.concept || e.note || t('expenseGeneric') || 'Gasto';
      if (!rowKeySet.has(rowKey)) {
        rowKeySet.set(rowKey, {
          key: rowKey,
          records: [],
        });
      }
      rowKeySet.get(rowKey).records.push({ ...e, monthKey, type: 'expense' });
    });

    // Convert to grid data structure
    const grid = Array.from(rowKeySet.values()).map((row) => {
      const monthData = {};
      row.records.forEach((record) => {
        if (!monthData[record.monthKey]) {
          monthData[record.monthKey] = [];
        }
        monthData[record.monthKey].push(record);
      });
      return {
        ...row,
        monthData,
        type: 'expense',
      };
    });

    // Sort rows by key
    grid.sort((a, b) => a.key.localeCompare(b.key));

    return grid;
  }, [expenses, t, selectedYear]);

  // Process income data grouped by category (filtered by selectedYear if set)
  const incomeGridData = useMemo(() => {
    const rowKeySet = new Map();
    
    // Process income - use notes (concepts) as the key directly
    (income || []).forEach((i) => {
      const ym = extractYearMonth(i.date);
      if (!ym) return;
      // Filter by year if selectedYear is set
      if (selectedYear !== null && ym.year !== selectedYear) return;
      const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      
      const rowKey = i.category?.name || i.categoryName || t('incomeGeneric') || 'Ingreso';
      if (!rowKeySet.has(rowKey)) {
        rowKeySet.set(rowKey, {
          key: rowKey,
          records: [],
        });
      }
      rowKeySet.get(rowKey).records.push({ ...i, monthKey, type: 'income' });
    });

    // Convert to grid data structure
    const grid = Array.from(rowKeySet.values()).map((row) => {
      const monthData = {};
      row.records.forEach((record) => {
        if (!monthData[record.monthKey]) {
          monthData[record.monthKey] = [];
        }
        monthData[record.monthKey].push(record);
      });
      return {
        ...row,
        monthData,
        type: 'income',
      };
    });

    // Sort rows by key
    grid.sort((a, b) => a.key.localeCompare(b.key));

    return grid;
  }, [income, t, selectedYear]);

  // Calculate totals for expenses rows
  const expensesRowTotals = useMemo(() => {
    const totals = new Map();
    expensesGridData.forEach((row) => {
      let total = 0;
      months.forEach((monthKey) => {
        const records = row.monthData[monthKey] || [];
        records.forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [expensesGridData, months]);

  // Calculate totals for expenses months
  const expensesMonthTotals = useMemo(() => {
    const totals = new Map();
    months.forEach((monthKey) => {
      let total = 0;
      expensesGridData.forEach((row) => {
        const records = row.monthData[monthKey] || [];
        records.forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(monthKey, total);
    });
    return totals;
  }, [expensesGridData, months]);

  // Calculate totals for income rows
  const incomeRowTotals = useMemo(() => {
    const totals = new Map();
    incomeGridData.forEach((row) => {
      let total = 0;
      months.forEach((monthKey) => {
        const records = row.monthData[monthKey] || [];
        records.forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [incomeGridData, months]);

  // Calculate totals for income months
  const incomeMonthTotals = useMemo(() => {
    const totals = new Map();
    months.forEach((monthKey) => {
      let total = 0;
      incomeGridData.forEach((row) => {
        const records = row.monthData[monthKey] || [];
        records.forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(monthKey, total);
    });
    return totals;
  }, [incomeGridData, months]);

  const handleCellClick = (rowIndex, monthKey, gridType) => {
    setSelectedCell({ rowIndex, monthKey, gridType });
    setEditingCell(null);
  };

  const handleCellDoubleClick = (rowIndex, monthKey, gridType, isTotal = false) => {
    // Don't allow editing totals or category totals
    // Category totals are read-only, users can only edit individual records in the expanded details view
    // This function intentionally does nothing - editing is handled elsewhere
    if (isTotal) {
      // No action needed for totals
    }
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    const { rowIndex, monthKey, gridType } = editingCell;
    const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
    const row = gridData[rowIndex];
    
    if (!row) return;

    try {
      const numValue = parseFloat(String(editValue).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue) || numValue < 0) {
        setEditingCell(null);
        setEditValue('');
        return;
      }

      const records = row.monthData[monthKey] || [];
      const currentTotal = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const difference = numValue - currentTotal;

      if (Math.abs(difference) < 0.01) {
        // No change
        setEditingCell(null);
        setEditValue('');
        return;
      }

      // If there are existing records, update the first one
      if (records.length > 0) {
        const record = records[0];
        const newAmount = Number(record.amount || 0) + difference;
        if (newAmount >= 0) {
          const updates = { amount: newAmount };
          if (gridType === 'expense') {
            await updateExpense(record.id, updates);
          } else {
            await updateIncome(record.id, updates);
          }
        }
      } else {
        // No records exist for this cell - create a new record
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)).toISOString();
        
        if (gridType === 'expense') {
          // Find or create category
          const categoryName = row.key.toLowerCase();
          let categoryId = null;
          const category = categories?.find(c => c.name?.toLowerCase() === categoryName);
          if (category) {
            categoryId = category.id;
          }
          
          await addExpense({
            categoryId,
            categoryName: categoryName,
            concept: row.key,
            amount: numValue,
            date,
            note: '',
          });
        } else {
          // For income, use row key as concept
          await addIncome({
            concept: row.key,
            categoryName: row.key,
            amount: numValue,
            date,
            note: '',
          });
        }
      }
    } catch (error) {
      // Error saving silently ignored
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleDetailDoubleClick = (record, monthKey, gridType, conceptLabel, categoryName) => {
    if (record) {
      const recordMonthKey = `${extractYearMonth(record.date)?.year}-${String(extractYearMonth(record.date)?.month).padStart(2, '0')}`;
      if (recordMonthKey !== monthKey) return; // Only edit if the record matches this month
      setEditingDetail({ recordId: record.id, monthKey, gridType, value: String(record.amount || 0), conceptLabel, categoryName });
    } else {
      // Empty cell - allow editing to create new record
      setEditingDetail({ recordId: null, monthKey, gridType, value: '', conceptLabel, categoryName });
    }
  };

  const handleDetailSave = async () => {
    if (!editingDetail) return;
    
    const { recordId, gridType, value, monthKey, conceptLabel, categoryName } = editingDetail;
    
    try {
      const numValue = parseFloat(String(value).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue) || numValue < 0) {
        setEditingDetail(null);
        return;
      }

      if (recordId) {
        // Update existing record
        const updates = { amount: numValue };
        if (gridType === 'expense') {
          await updateExpense(recordId, updates);
        } else {
          await updateIncome(recordId, updates);
        }
      } else {
        // Create new record - only if value is valid and > 0
        if (numValue <= 0) {
          setEditingDetail(null);
          return;
        }
        
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
        const dateString = date.toISOString();
        
        // Find category by name
        const category = categories?.find(c => String(c.name || '').trim().toLowerCase() === String(categoryName || '').trim().toLowerCase());
        const categoryId = category?.id;
        
        if (!categoryId) {
          setEditingDetail(null);
          return;
        }

        const newRecord = {
          concept: conceptLabel || (t('concept') || 'Concepto'),
          amount: numValue,
          date: dateString,
          categoryId,
          categoryName: categoryName,
          currency: 'ARS',
        };

        if (gridType === 'expense') {
          await addExpense(newRecord);
        } else {
          await addIncome(newRecord);
        }
      }
    } catch (error) {
      // Error saving silently ignored
    } finally {
      setEditingDetail(null);
    }
  };

  const handleKeyDown = (e, gridType) => {
    if (!selectedCell || selectedCell.gridType !== gridType) return;

    const { rowIndex, monthKey } = selectedCell;
    const monthIndex = months.indexOf(monthKey);
    const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
    
    if (editingCell && editingCell.gridType === gridType) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCell(null);
        setEditValue('');
      }
      return;
    }

    // Navigation keys
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      handleCellDoubleClick(rowIndex, monthKey, gridType);
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      setSelectedCell({ rowIndex: rowIndex - 1, monthKey, gridType });
    } else if (e.key === 'ArrowDown' && rowIndex < gridData.length - 1) {
      e.preventDefault();
      setSelectedCell({ rowIndex: rowIndex + 1, monthKey, gridType });
    } else if (e.key === 'ArrowLeft' && monthIndex > 0) {
      e.preventDefault();
      setSelectedCell({ rowIndex, monthKey: months[monthIndex - 1], gridType });
    } else if (e.key === 'ArrowRight' && monthIndex < months.length - 1) {
      e.preventDefault();
      setSelectedCell({ rowIndex, monthKey: months[monthIndex + 1], gridType });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (monthIndex > 0) {
          setSelectedCell({ rowIndex, monthKey: months[monthIndex - 1], gridType });
        } else if (rowIndex > 0) {
          setSelectedCell({ rowIndex: rowIndex - 1, monthKey: months[months.length - 1], gridType });
        }
      } else {
        if (monthIndex < months.length - 1) {
          setSelectedCell({ rowIndex, monthKey: months[monthIndex + 1], gridType });
        } else if (rowIndex < gridData.length - 1) {
          setSelectedCell({ rowIndex: rowIndex + 1, monthKey: months[0], gridType });
        }
      }
    }
  };

  useEffect(() => {
    if ((editingCell || editingDetail) && inputRef.current) {
      // Create a unique key for this editing session
      const editingKey = editingCell 
        ? `${editingCell.gridType}-${editingCell.rowIndex}-${editingCell.monthKey}`
        : editingDetail 
        ? `${editingDetail.gridType}-${editingDetail.recordId || 'new'}-${editingDetail.monthKey}-${editingDetail.conceptLabel}`
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
  }, [editingCell, editingDetail]);

  const renderCell = (row, monthKey, rowIndex, gridType) => {
    const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell?.monthKey === monthKey && selectedCell?.gridType === gridType;
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.monthKey === monthKey && editingCell?.gridType === gridType;

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => handleKeyDown(e, gridType)}
          className="w-full h-full px-1 py-0.5 border-2 border-blue-500 bg-white dark:bg-gray-800 text-sm focus:outline-none text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          style={{ minWidth: '85px' }}
        />
      );
    }

    const records = row.monthData[monthKey] || [];
    const totalAmount = Math.round(records.reduce((sum, r) => sum + Number(r.amount || 0), 0));
    const displayValue = totalAmount !== 0 ? formatMoneyNoDecimals(totalAmount, 'ARS', { sign: 'auto' }) : '-';
    const isForecast = isForecastMonth(monthKey);

    return (
      <div
        className={`px-1 py-0.5 text-sm text-center ${isSelected ? 'bg-blue-200 dark:bg-blue-800/50' : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'} ${isForecast ? 'opacity-60 italic' : ''}`}
        onClick={() => handleCellClick(rowIndex, monthKey, gridType)}
        onDoubleClick={() => handleCellDoubleClick(rowIndex, monthKey, gridType)}
        style={{ minHeight: '20px', cursor: 'default' }}
        title={isForecast ? (t('forecast') || 'Pronóstico') : (t('expandToEditDetails') || 'Expandir para editar detalles individuales')}
      >
        {displayValue}
      </div>
    );
  };

  const renderGrid = (gridData, rowTotals, monthTotals, gridType, title) => {
    const lastPastMonthIndex = getLastPastMonthIndex(months);
    
    return (
    <div className="mb-8">
      <div className="mb-2">
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
      <div
        ref={gridType === 'expense' ? gridRef : null}
        className="border-2 border-gray-400 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 overflow-x-auto"
        onKeyDown={(e) => handleKeyDown(e, gridType)}
        tabIndex={0}
        style={{ maxWidth: '100%' }}
      >
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 bg-blue-50 dark:bg-blue-900/20 z-10">
            <tr>
              <th className="sticky left-0 border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 z-20" style={{ width: 100, minWidth: 100 }}>
                {t('category') || 'Categoría'}
              </th>
              {months.map((monthKey, index) => {
                const [year, month] = monthKey.split('-').map(Number);
                const isLastPastMonth = index === lastPastMonthIndex;
                return (
                  <th
                    key={monthKey}
                    className={`border-2 border-blue-300 dark:border-blue-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''}`}
                    style={{ width: 85, minWidth: 85 }}
                    title={`${formatMonthYearLabel(year, month)} ${year}`}
                  >
                    {formatMonthYearLabel(year, month)}
                  </th>
                );
              })}
              <th className="border-2 border-blue-300 dark:border-blue-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20" style={{ width: 95, minWidth: 95 }}>
                {t('total') || 'Total'}
              </th>
            </tr>
          </thead>
          <tbody>
            {gridData.length === 0 ? (
              <tr>
                <td colSpan={months.length + 2} className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('noData') || 'No hay datos'}
                </td>
              </tr>
            ) : (
              gridData.map((row, rowIndex) => (
                <React.Fragment key={row.key}>
                  <tr
                    className={`border-b-2 border-gray-300 dark:border-gray-600 ${
                      selectedCell?.rowIndex === rowIndex && selectedCell?.gridType === gridType ? 'bg-blue-100/70 dark:bg-blue-900/30' : ''
                    } hover:bg-amber-50/50 dark:hover:bg-amber-900/20`}
                  >
                    <td 
                      className="sticky left-0 border-r-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-xs bg-white dark:bg-gray-900 z-10 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30" 
                      style={{ width: 100, minWidth: 100 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const expandedKey = `${gridType}-${row.key}`;
                        setExpandedCategory(expandedCategory === expandedKey ? null : expandedKey);
                      }}
                    >
                      <div className="relative flex items-center justify-center overflow-hidden" style={{ paddingLeft: '1rem' }}>
                        <span className="material-symbols-outlined text-xs absolute left-0 flex-shrink-0" style={{ transform: expandedCategory === `${gridType}-${row.key}` ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                          chevron_right
                        </span>
                        <span className="truncate text-center flex-1 min-w-0">{capitalizeWords(row.key)}</span>
                      </div>
                    </td>
                    {months.map((monthKey, index) => {
                      const isLastPastMonth = index === lastPastMonthIndex;
                      return (
                        <td
                          key={monthKey}
                          className={`border-r-2 border-gray-300 dark:border-gray-600 p-0 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''}`}
                          style={{ width: 85, minWidth: 85 }}
                        >
                          {renderCell(row, monthKey, rowIndex, gridType)}
                        </td>
                      );
                    })}
                    <td className="border-l-2 border-gray-400 dark:border-gray-500 px-1.5 py-1 text-sm text-center font-semibold bg-white dark:bg-gray-900" style={{ width: 95, minWidth: 95 }}>
                      {formatMoneyNoDecimals(Math.round(rowTotals.get(row.key) || 0), 'ARS', { sign: 'auto' })}
                    </td>
                  </tr>
                  {expandedCategory === `${gridType}-${row.key}` && (
                    <tr>
                      <td colSpan={months.length + 2} className="border border-gray-200 dark:border-gray-700 p-0 bg-gray-50 dark:bg-gray-800/50">
                        <div className="p-4">
                          <h4 className="font-semibold text-sm mb-3">{t('details') || 'Detalles'} - {capitalizeWords(row.key)}</h4>
                          <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg">
                            <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
                              <thead className="bg-indigo-100 dark:bg-indigo-900/40">
                                <tr>
                                  <th className="sticky left-0 border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40 z-20" style={{ width: 100, minWidth: 100 }}>
                                    {t('concept') || 'Concepto'}
                                  </th>
                                  {months.map((monthKey) => {
                                    const [year, month] = monthKey.split('-').map(Number);
                                    return (
                                      <th
                                        key={monthKey}
                                        className="border-2 border-indigo-300 dark:border-indigo-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40"
                                        style={{ width: 85, minWidth: 85 }}
                                        title={`${formatMonthYearLabel(year, month)} ${year}`}
                                      >
                                        {formatMonthYearLabel(year, month)}
                                      </th>
                                    );
                                  })}
                                  <th className="border-2 border-indigo-300 dark:border-indigo-700 px-1.5 py-1.5 text-right text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40" style={{ width: 90, minWidth: 90 }}>
                                    {t('total') || 'Total'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  // Group records by concept for both expenses and income
                                  const conceptMap = new Map();
                                  row.records.forEach((record) => {
                                  const conceptLabel = record.concept || record.note || (t('concept') || 'Concepto');
                                    if (!conceptMap.has(conceptLabel)) {
                                      conceptMap.set(conceptLabel, {
                                        label: conceptLabel,
                                        type: record.type,
                                        records: [],
                                      });
                                    }
                                    conceptMap.get(conceptLabel).records.push(record);
                                  });

                                  // Convert to array and sort by label
                                  const groupedConcepts = Array.from(conceptMap.values()).sort((a, b) => 
                                    a.label.localeCompare(b.label)
                                  );

                                  return groupedConcepts.map((concept, idx) => {
                                    // Calculate total for this concept
                                    const conceptTotal = concept.records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                    
                                    // Determine if concept has mixed types (unused for now, but kept for future use)
                                    // const hasMixedTypes = new Set(concept.records.map(r => r.type)).size > 1;
                                    return (
                                        <tr key={`concept-${idx}`} className="border-b-2 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                                        <td className="sticky left-0 border-r-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-xs text-center bg-white dark:bg-gray-900 z-10" style={{ width: 100, minWidth: 100 }}>
                                          <div className="flex items-center justify-center gap-1">
                                            <span className="truncate">{capitalizeWords(concept.label)}</span>
                                          </div>
                                        </td>
                                        {months.map((monthKey, index) => {
                                          // Find all records for this concept and month
                                          const monthRecords = concept.records.filter(r => r.monthKey === monthKey);
                                          const isForecast = isForecastMonth(monthKey);
                                          const isLastPastMonth = index === lastPastMonthIndex;
                                          
                                          // Check if this cell is being edited (either has a record being edited, or is an empty cell being edited)
                                          const editingRecord = monthRecords.find(r => editingDetail?.recordId === r.id && editingDetail?.monthKey === monthKey);
                                          const isEditingEmpty = editingDetail?.recordId === null && editingDetail?.monthKey === monthKey && editingDetail?.conceptLabel === concept.label;
                                          const isEditing = !!editingRecord || isEditingEmpty;
                                          
                                          if (isEditing && (editingRecord || isEditingEmpty)) {
                                            return (
                                              <td
                                                key={monthKey}
                                                className={`border-r-2 border-indigo-200 dark:border-indigo-700 p-0 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''}`}
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
                                                      void handleDetailSave();
                                                    } else if (e.key === 'Escape') {
                                                      e.preventDefault();
                                                      setEditingDetail(null);
                                                    }
                                                  }}
                                                  className="w-full h-full px-1 py-0.5 border-2 border-blue-500 bg-white dark:bg-gray-800 text-sm focus:outline-none text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                                                  style={{ minWidth: '85px' }}
                                                />
                                              </td>
                                            );
                                          }
                                          
                                          // Sum all amounts for this concept in this month
                                          const monthAmount = monthRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                          
                                          // If there are records, make the first one editable
                                          const firstRecord = monthRecords[0];
                                          
                                          return (
                                            <td
                                              key={monthKey}
                                              className={`border-r-2 border-indigo-200 dark:border-indigo-700 px-1 py-1 text-sm text-center hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-cell ${isForecast ? 'opacity-60 italic' : ''} ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''}`}
                                              style={{ width: 85, minWidth: 85 }}
                                              onDoubleClick={() => handleDetailDoubleClick(firstRecord || null, monthKey, gridType, concept.label, row.key)}
                                              title={isForecast ? (t('forecast') || 'Pronóstico') : (t('doubleClickToEdit') || 'Doble click para editar')}
                                            >
                                              {monthAmount !== 0 ? formatMoneyNoDecimals(Math.round(monthAmount), 'ARS', { sign: 'auto' }) : '-'}
                                            </td>
                                          );
                                        })}
                                        <td className="border-l-2 border-indigo-300 dark:border-indigo-600 px-1.5 py-1 text-sm text-center font-semibold bg-indigo-50 dark:bg-indigo-900/20" style={{ width: 95, minWidth: 95 }}>
                                          {formatMoneyNoDecimals(Math.round(conceptTotal), 'ARS', { sign: 'auto' })}
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                              <tfoot className="bg-indigo-200 dark:bg-indigo-900/50">
                                <tr>
                                  <td className="sticky left-0 border-2 border-indigo-400 dark:border-indigo-600 px-1.5 py-1.5 text-xs text-center font-bold text-gray-800 dark:text-gray-100 bg-indigo-200 dark:bg-indigo-900/50 z-20" style={{ width: 100, minWidth: 100 }}>
                                    {t('total') || 'Total'}
                                  </td>
                                  {months.map((monthKey) => {
                                    const monthTotal = row.records
                                      .filter(r => r.monthKey === monthKey)
                                      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                    return (
                                      <td
                                        key={monthKey}
                                        className="border-2 border-indigo-400 dark:border-indigo-600 px-1 py-1 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-indigo-200 dark:bg-indigo-900/50"
                                        style={{ width: 85, minWidth: 85 }}
                                      >
                                        {formatMoneyNoDecimals(Math.round(monthTotal), 'ARS', { sign: 'auto' })}
                                      </td>
                                    );
                                  })}
                                  <td className="border-2 border-indigo-400 dark:border-indigo-600 px-1.5 py-1.5 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-indigo-200 dark:bg-indigo-900/50" style={{ width: 95, minWidth: 95 }}>
                                    {formatMoneyNoDecimals(Math.round(rowTotals.get(row.key) || 0), 'ARS', { sign: 'auto' })}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-white dark:bg-gray-900 z-10">
            <tr>
              <td className="sticky left-0 border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-xs text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 z-20" style={{ width: 100, minWidth: 100 }}>
                {t('total') || 'Total'}
              </td>
              {months.map((monthKey, index) => {
                const isLastPastMonth = index === lastPastMonthIndex;
                return (
                  <td
                    key={monthKey}
                    className={`border-2 border-gray-400 dark:border-gray-600 px-1 py-1 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''}`}
                    style={{ width: 85, minWidth: 85 }}
                  >
                    {formatMoneyNoDecimals(Math.round(monthTotals.get(monthKey) || 0), 'ARS', { sign: 'auto' })}
                  </td>
                );
              })}
              <td className="border-2 border-gray-400 dark:border-gray-600 px-1.5 py-1.5 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900" style={{ width: 95, minWidth: 95 }}>
                {formatMoneyNoDecimals(Math.round(Array.from(monthTotals.values()).reduce((sum, val) => sum + Number(val || 0), 0)), 'ARS', { sign: 'auto' })}
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
            <p className="text-4xl font-black tracking-[-0.033em]">{t('grid') || 'Grilla'}</p>
            <p className="text-[#616f89] dark:text-gray-400">{t('gridSubtitle') || 'Visualización tipo Excel de todos los registros'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('year') || 'Año'}:
              </label>
              <CustomSelect
                id="year-select"
                value={selectedYear !== null ? String(selectedYear) : ''}
                onChange={(v) => setSelectedYear(v === '' ? null : Number(v))}
                options={[
                  { value: '', label: t('allYears') || 'Todos los años' },
                  ...availableYears.map((year) => ({ value: String(year), label: String(year) }))
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="forecast-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('showForecast') || 'Mostrar Forecast'}:
              </label>
              <button
                id="forecast-toggle"
                type="button"
                onClick={() => setShowForecast(!showForecast)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showForecast ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={showForecast}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showForecast ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/forecast')}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('forecastNewYear') || 'Forecast año nuevo'}
            </button>
          </div>
        </div>
      </div>

      {renderGrid(expensesGridData, expensesRowTotals, expensesMonthTotals, 'expense', t('expenses') || 'Gastos')}
      {renderGrid(incomeGridData, incomeRowTotals, incomeMonthTotals, 'income', t('income') || 'Ingresos')}
    </div>
  );
}

