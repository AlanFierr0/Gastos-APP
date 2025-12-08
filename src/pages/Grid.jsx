import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { formatMoneyNoDecimals, capitalizeWords, extractYearMonth } from '../utils/format.js';
import CustomSelect from '../components/CustomSelect.jsx';

function isForecastMonth(monthKey, currentMonthKey = null) {
  // monthKey format: "YYYY-MM"
  const [year, month] = monthKey.split('-').map(Number);
  
  // If currentMonthKey is provided, use it to determine forecast
  if (currentMonthKey) {
    const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
    // If year is in the future, it's forecast
    if (year > currentYear) return true;
    // If year is in the past, it's not forecast
    if (year < currentYear) return false;
    // If same year, month > current month is forecast
    return month > currentMonth;
  }
  
  // Fallback to system date if no currentMonthKey provided
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

function getLastPastMonthIndex(months, currentMonthKey = null) {
  for (let i = months.length - 1; i >= 0; i--) {
    if (!isForecastMonth(months[i], currentMonthKey)) {
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

function getMonthNameInSpanish(month) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return monthNames[month - 1];
}

function getAvailableCurrentMonthOptions(selectedCurrentMonthKey = null) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  
  // If a selectedCurrentMonthKey is provided, use it as the minimum allowed month
  let minYear, minMonth;
  if (selectedCurrentMonthKey) {
    [minYear, minMonth] = selectedCurrentMonthKey.split('-').map(Number);
  } else {
    // Start from previous month (currentMonth - 1)
    // If currentMonth is 1 (January), previous month is December of previous year
    minYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    minMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  }
  
  const options = [];
  
  // Add months from minMonth/minYear to end of next year
  // First, add remaining months of minYear (from minMonth to December)
  for (let month = minMonth; month <= 12; month++) {
    const monthKey = `${minYear}-${String(month).padStart(2, '0')}`;
    const label = `${getMonthNameInSpanish(month)} ${minYear}`;
    options.push({ value: monthKey, label });
  }
  
  // Add all months of next year (minYear + 1)
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${minYear + 1}-${String(month).padStart(2, '0')}`;
    const label = `${getMonthNameInSpanish(month)} ${minYear + 1}`;
    options.push({ value: monthKey, label });
  }
  
  return options;
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
  const [cellEditModal, setCellEditModal] = useState(null); // { rowIndex, monthKey, gridType, records, currentTotal, rowKey }
  const [modalValue, setModalValue] = useState(''); // Valor único para todas las operaciones
  const [modalNote, setModalNote] = useState('');
  const [modalAction, setModalAction] = useState(null); // 'edit', 'add', 'subtract', o null
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const lastEditingKeyRef = useRef(null);
  
  // Estado para el mes actual seleccionado manualmente
  const [currentMonthKey, setCurrentMonthKey] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
  
  // Estado para el modal de confirmación de cambio de mes
  const [showMonthChangeConfirm, setShowMonthChangeConfirm] = useState(false);
  const [pendingMonthKey, setPendingMonthKey] = useState(null);

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

  // Ensure currentMonthKey is valid when selectedYear changes
  useEffect(() => {
    if (selectedYear !== null) {
      const [currentYear] = currentMonthKey.split('-').map(Number);
      if (currentYear !== selectedYear) {
        // If current month is not in selected year, set to first month of selected year
        const newMonthKey = `${selectedYear}-01`;
        setCurrentMonthKey(newMonthKey);
      }
    }
  }, [selectedYear]);

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
      if (!showForecast && isForecastMonth(monthKey, currentMonthKey)) return;
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
      if (!showForecast && isForecastMonth(monthKey, currentMonthKey)) return;
      monthSet.add(monthKey);
    });

    // Always include currentMonthKey if it's not already in the set
    if (currentMonthKey && !monthSet.has(currentMonthKey)) {
      monthSet.add(currentMonthKey);
    }

    // Sort months ascending (January first, December last)
    return Array.from(monthSet).sort((a, b) => a.localeCompare(b));
  }, [expenses, income, selectedYear, showForecast, currentMonthKey]);

  // Helper function to check if a record is forecast
  const isForecastRecord = (record) => {
    if (!record) return false;
    const note = record.note || '';
    const isForecast = note.toLowerCase().includes('forecast');
    // Debug log (remove after fixing)
    if (isForecast && record.monthKey) {
      console.log('Forecast record detected:', {
        id: record.id,
        monthKey: record.monthKey,
        note: record.note,
        currentMonthKey,
        amount: record.amount
      });
    }
    return isForecast;
  };

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
      const monthDataForecast = {}; // Separate forecast data for current month
      
      // First, initialize empty arrays for current month to ensure clean separation
      if (currentMonthKey) {
        monthData[currentMonthKey] = [];
        monthDataForecast[currentMonthKey] = [];
      }
      
      row.records.forEach((record) => {
        const recordMonthKey = record.monthKey;
        const isForecast = isForecastRecord(record);
        
        // For current month, ALWAYS separate real and forecast
        if (recordMonthKey === currentMonthKey) {
          if (isForecast) {
            // Forecast records MUST go to monthDataForecast ONLY - NEVER to monthData
            monthDataForecast[recordMonthKey].push(record);
            // Debug log
            console.log('✓ Forecast record added to monthDataForecast:', {
              rowKey: row.key,
              recordMonthKey,
              currentMonthKey,
              recordId: record.id,
              note: record.note,
              amount: record.amount
            });
          } else {
            // Real records go to monthData ONLY - NEVER to monthDataForecast
            monthData[recordMonthKey].push(record);
            // Debug log for real records in current month
            if (record.note && record.note.toLowerCase().includes('forecast')) {
              console.error('ERROR: Real record has forecast note!', {
                rowKey: row.key,
                recordId: record.id,
                note: record.note
              });
            }
          }
        } else {
          // For other months, use normal structure (all records go to monthData, regardless of forecast status)
          if (!monthData[recordMonthKey]) {
            monthData[recordMonthKey] = [];
          }
          monthData[recordMonthKey].push(record);
        }
      });
      
      // Final verification: ensure no forecast records in monthData for current month
      if (currentMonthKey && monthData[currentMonthKey]) {
        const forecastInMonthData = monthData[currentMonthKey].filter(r => isForecastRecord(r));
        if (forecastInMonthData.length > 0) {
          console.error('ERROR: Found forecast records in monthData for current month!', {
            rowKey: row.key,
            currentMonthKey,
            forecastRecords: forecastInMonthData.map(r => ({ id: r.id, note: r.note }))
          });
          // Remove forecast records from monthData
          monthData[currentMonthKey] = monthData[currentMonthKey].filter(r => !isForecastRecord(r));
          // Add them to monthDataForecast
          forecastInMonthData.forEach(r => {
            monthDataForecast[currentMonthKey].push(r);
          });
        }
      }
      return {
        ...row,
        monthData,
        monthDataForecast, // Forecast data for current month
        type: 'expense',
      };
    });

    // Sort rows by key
    grid.sort((a, b) => a.key.localeCompare(b.key));

    return grid;
  }, [expenses, t, selectedYear, currentMonthKey]);

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
      const monthDataForecast = {}; // Separate forecast data for current month
      
      // First, initialize empty arrays for current month to ensure clean separation
      if (currentMonthKey) {
        monthData[currentMonthKey] = [];
        monthDataForecast[currentMonthKey] = [];
      }
      
      row.records.forEach((record) => {
        const recordMonthKey = record.monthKey;
        const isForecast = isForecastRecord(record);
        
        // For current month, ALWAYS separate real and forecast
        if (recordMonthKey === currentMonthKey) {
          if (isForecast) {
            // Forecast records MUST go to monthDataForecast ONLY - NEVER to monthData
            monthDataForecast[recordMonthKey].push(record);
            // Debug log
            console.log('✓ Forecast record added to monthDataForecast:', {
              rowKey: row.key,
              recordMonthKey,
              currentMonthKey,
              recordId: record.id,
              note: record.note,
              amount: record.amount
            });
          } else {
            // Real records go to monthData ONLY - NEVER to monthDataForecast
            monthData[recordMonthKey].push(record);
            // Debug log for real records in current month
            if (record.note && record.note.toLowerCase().includes('forecast')) {
              console.error('ERROR: Real record has forecast note!', {
                rowKey: row.key,
                recordId: record.id,
                note: record.note
              });
            }
          }
        } else {
          // For other months, use normal structure (all records go to monthData, regardless of forecast status)
          if (!monthData[recordMonthKey]) {
            monthData[recordMonthKey] = [];
          }
          monthData[recordMonthKey].push(record);
        }
      });
      
      // Final verification: ensure no forecast records in monthData for current month
      if (currentMonthKey && monthData[currentMonthKey]) {
        const forecastInMonthData = monthData[currentMonthKey].filter(r => isForecastRecord(r));
        if (forecastInMonthData.length > 0) {
          console.error('ERROR: Found forecast records in monthData for current month!', {
            rowKey: row.key,
            currentMonthKey,
            forecastRecords: forecastInMonthData.map(r => ({ id: r.id, note: r.note }))
          });
          // Remove forecast records from monthData
          monthData[currentMonthKey] = monthData[currentMonthKey].filter(r => !isForecastRecord(r));
          // Add them to monthDataForecast
          forecastInMonthData.forEach(r => {
            monthDataForecast[currentMonthKey].push(r);
          });
        }
      }
      
      return {
        ...row,
        monthData,
        monthDataForecast, // Forecast data for current month
        type: 'income',
      };
    });

    // Sort rows by key
    grid.sort((a, b) => a.key.localeCompare(b.key));

    return grid;
  }, [income, t, selectedYear, currentMonthKey]);

  // Calculate totals for expenses rows
  const expensesRowTotals = useMemo(() => {
    const totals = new Map();
    expensesGridData.forEach((row) => {
      let total = 0;
      months.forEach((monthKey) => {
        // Include both real and forecast for current month
        const realRecords = row.monthData[monthKey] || [];
        const forecastRecords = (monthKey === currentMonthKey) ? (row.monthDataForecast?.[monthKey] || []) : [];
        [...realRecords, ...forecastRecords].forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [expensesGridData, months, currentMonthKey]);

  // Calculate totals for expenses months
  const expensesMonthTotals = useMemo(() => {
    const totals = new Map();
    months.forEach((monthKey) => {
      let total = 0;
      expensesGridData.forEach((row) => {
        // Include both real and forecast for current month
        const realRecords = row.monthData[monthKey] || [];
        const forecastRecords = (monthKey === currentMonthKey) ? (row.monthDataForecast?.[monthKey] || []) : [];
        [...realRecords, ...forecastRecords].forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(monthKey, total);
    });
    return totals;
  }, [expensesGridData, months, currentMonthKey]);

  // Calculate totals for income rows
  const incomeRowTotals = useMemo(() => {
    const totals = new Map();
    incomeGridData.forEach((row) => {
      let total = 0;
      months.forEach((monthKey) => {
        // Include both real and forecast for current month
        const realRecords = row.monthData[monthKey] || [];
        const forecastRecords = (monthKey === currentMonthKey) ? (row.monthDataForecast?.[monthKey] || []) : [];
        [...realRecords, ...forecastRecords].forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(row.key, total);
    });
    return totals;
  }, [incomeGridData, months, currentMonthKey]);

  // Calculate totals for income months
  const incomeMonthTotals = useMemo(() => {
    const totals = new Map();
    months.forEach((monthKey) => {
      let total = 0;
      incomeGridData.forEach((row) => {
        // Include both real and forecast for current month
        const realRecords = row.monthData[monthKey] || [];
        const forecastRecords = (monthKey === currentMonthKey) ? (row.monthDataForecast?.[monthKey] || []) : [];
        [...realRecords, ...forecastRecords].forEach((record) => {
          total += Number(record.amount || 0);
        });
      });
      totals.set(monthKey, total);
    });
    return totals;
  }, [incomeGridData, months, currentMonthKey]);

  const handleCellClick = (rowIndex, monthKey, gridType, isForecast = false) => {
    setSelectedCell({ rowIndex, monthKey, gridType, isForecast });
    setEditingCell(null);
  };

  const handleCellDoubleClick = (rowIndex, monthKey, gridType, isTotal = false) => {
    if (isTotal) {
      return; // Don't allow editing totals
    }
    // El popup solo se abre cuando se edita un concepto dentro de una categoría expandida
    // Las celdas principales de categorías no abren popup
    return;
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    const { rowIndex, monthKey, gridType, isForecast } = editingCell;
    const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
    const row = gridData[rowIndex];
    
    if (!row) return;

    try {
      const numValue = parseFloat(String(editValue).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue)) {
        setEditingCell(null);
        setEditValue('');
        return;
      }

      // For current month, use separate data for real and forecast
      const records = (monthKey === currentMonthKey && isForecast)
        ? (row.monthDataForecast?.[monthKey] || [])
        : (row.monthData[monthKey] || []);
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
        const updates = { amount: newAmount };
        if (gridType === 'expense') {
          await updateExpense(record.id, updates);
        } else {
          await updateIncome(record.id, updates);
        }
      } else {
        // No records exist for this cell - create a new record
        const [year, month] = monthKey.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)).toISOString();
        
        // Determine note based on whether it's forecast
        const note = (monthKey === currentMonthKey && isForecast) 
          ? `Forecast ${year}`
          : '';
        
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
            note,
            currency: 'ARS',
          });
        } else {
          // For income, use row key as concept
          await addIncome({
            concept: row.key,
            categoryName: row.key,
            amount: numValue,
            date,
            note,
            currency: 'ARS',
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
    // Solo abrir popup cuando se edita un concepto dentro de una categoría expandida
    if (record) {
      const recordMonthKey = `${extractYearMonth(record.date)?.year}-${String(extractYearMonth(record.date)?.month).padStart(2, '0')}`;
      if (recordMonthKey !== monthKey) return; // Only edit if the record matches this month
      
      // Obtener todos los registros de este concepto en este mes
      const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
      const row = gridData.find(r => r.key === categoryName);
      if (!row) return;
      
      // Filtrar registros por concepto y mes
      const conceptRecords = row.records.filter(r => {
        const rConcept = r.concept || r.note || '';
        const rMonthKey = r.monthKey || `${extractYearMonth(r.date)?.year}-${String(extractYearMonth(r.date)?.month).padStart(2, '0')}`;
        return rConcept === conceptLabel && rMonthKey === monthKey;
      });
      
      const currentTotal = conceptRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const note = conceptRecords[0]?.note || '';
      
      // Encontrar el índice de la fila para el modal
      const rowIndex = gridData.findIndex(r => r.key === categoryName);
      
      setCellEditModal({
        rowIndex,
        monthKey,
        gridType,
        records: conceptRecords,
        currentTotal,
        rowKey: categoryName,
        conceptLabel, // Agregar el concepto al modal
      });
      setModalValue('');
      setModalNote(note);
      setModalAction(null);
    } else {
      // Empty cell - crear nuevo registro
      const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
      const row = gridData.find(r => r.key === categoryName);
      if (!row) return;
      
      const rowIndex = gridData.findIndex(r => r.key === categoryName);
      
      setCellEditModal({
        rowIndex,
        monthKey,
        gridType,
        records: [],
        currentTotal: 0,
        rowKey: categoryName,
        conceptLabel,
      });
      setModalValue('');
      setModalNote('');
      setModalAction(null);
    }
  };

  const handleCellModalSave = async () => {
    if (!cellEditModal || !modalAction) return;

    const { rowIndex, monthKey, gridType, records, rowKey, conceptLabel } = cellEditModal;
    const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
    const row = gridData[rowIndex];
    
    if (!row) return;

    try {
      const currentTotal = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      let newAmount = currentTotal;
      let hasValueChange = false;

      // Parsear el valor ingresado
      const cleanValue = String(modalValue).replace(/\./g, '').replace(',', '.');
      const inputValue = parseFloat(cleanValue);
      
      if (!isNaN(inputValue) && inputValue !== 0) {
        hasValueChange = true;

        if (modalAction === 'edit') {
          // Editar: establecer el valor directamente al valor ingresado
          newAmount = inputValue;
        } else if (modalAction === 'add') {
          // Sumar: valor actual + valor ingresado
          newAmount = currentTotal + inputValue;
        } else if (modalAction === 'subtract') {
          // Restar: valor actual - valor ingresado
          newAmount = currentTotal - inputValue;
        }
      }

      // Si no hay cambio de valor ni de nota, cerrar
      if (!hasValueChange && modalNote === (records[0]?.note || '')) {
        setCellEditModal(null);
        setModalValue('');
        setModalNote('');
        setModalAction(null);
        return;
      }

      // Calcular la diferencia para aplicar al registro (solo si hay cambio de valor)
      const difference = hasValueChange ? (newAmount - currentTotal) : 0;

      // Si hay conceptLabel, estamos editando un concepto dentro de una categoría expandida
      if (conceptLabel) {
        // Update first record or create new one for this concept
        if (records.length > 0) {
          const record = records[0];
          const updates = {};
          
          if (hasValueChange) {
            updates.amount = Number(record.amount || 0) + difference;
          }
          
          if (modalNote !== (record.note || '')) {
            updates.note = modalNote.trim() || undefined;
          }
          
          // Solo actualizar si hay cambios
          if (Object.keys(updates).length > 0) {
            if (gridType === 'expense') {
              await updateExpense(record.id, updates);
            } else {
              await updateIncome(record.id, updates);
            }
          }
        } else if (hasValueChange) {
          // Create new record for this concept
          const [year, month] = monthKey.split('-').map(Number);
          const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)).toISOString();
          
          const category = categories?.find(c => c.name?.toLowerCase() === rowKey.toLowerCase());
          const categoryId = category?.id;

          if (gridType === 'expense') {
            await addExpense({
              categoryId,
              categoryName: rowKey.toLowerCase(),
              concept: conceptLabel,
              amount: newAmount,
              date,
              note: modalNote.trim() || undefined,
            });
          } else {
            await addIncome({
              concept: conceptLabel,
              categoryName: rowKey,
              amount: newAmount,
              date,
              note: modalNote.trim() || undefined,
            });
          }
        }
      } else {
        // Comportamiento original para cuando no hay conceptLabel (no debería pasar ahora)
        // Update first record or create new one
        if (records.length > 0) {
          const record = records[0];
          const updates = {};
          
          if (hasValueChange) {
            updates.amount = Number(record.amount || 0) + difference;
          }
          
          if (modalNote !== (record.note || '')) {
            updates.note = modalNote.trim() || undefined;
          }
          
          // Solo actualizar si hay cambios
          if (Object.keys(updates).length > 0) {
            if (gridType === 'expense') {
              await updateExpense(record.id, updates);
            } else {
              await updateIncome(record.id, updates);
            }
          }
        } else if (hasValueChange) {
          // Create new record (solo si hay cambio de valor)
          const [year, month] = monthKey.split('-').map(Number);
          const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0)).toISOString();
          
          const category = categories?.find(c => c.name?.toLowerCase() === rowKey.toLowerCase());
          const categoryId = category?.id;

          if (gridType === 'expense') {
            await addExpense({
              categoryId,
              categoryName: rowKey.toLowerCase(),
              concept: rowKey,
              amount: newAmount,
              date,
              note: modalNote.trim() || undefined,
            });
          } else {
            await addIncome({
              concept: rowKey,
              categoryName: rowKey,
              amount: newAmount,
              date,
              note: modalNote.trim() || undefined,
            });
    }
        }
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setCellEditModal(null);
      setModalValue('');
      setModalNote('');
      setModalAction(null);
    }
  };

  // Calcular el valor resultante según la acción seleccionada
  const calculateResultValue = () => {
    if (!cellEditModal || !modalAction) return null;
    
    const currentTotal = cellEditModal.currentTotal;
    const cleanValue = String(modalValue).replace(/\./g, '').replace(',', '.');
    const inputValue = parseFloat(cleanValue);
    
    if (isNaN(inputValue) || inputValue === 0) return null;
    
    if (modalAction === 'edit') {
      return inputValue;
    } else if (modalAction === 'add') {
      return currentTotal + inputValue;
    } else if (modalAction === 'subtract') {
      return currentTotal - inputValue;
    }
    
    return null;
  };

  const handleDetailSave = async () => {
    if (!editingDetail) return;
    
    const { recordId, gridType, value, monthKey, conceptLabel, categoryName } = editingDetail;
    
    try {
      const numValue = parseFloat(String(value).replace(/[^\d.-]/g, ''));
      if (isNaN(numValue)) {
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
        // Create new record - only if value is valid (can be negative)
        if (numValue === 0) {
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

    const { rowIndex, monthKey, isForecast } = selectedCell;
    const gridData = gridType === 'expense' ? expensesGridData : incomeGridData;
    
    // Build columns array for navigation
    const columns = [];
    months.forEach((mk) => {
      if (mk === currentMonthKey) {
        columns.push({ monthKey: mk, isForecast: false });
        columns.push({ monthKey: mk, isForecast: true });
      } else {
        columns.push({ monthKey: mk, isForecast: false });
      }
    });
    
    const currentColIndex = columns.findIndex(col => col.monthKey === monthKey && col.isForecast === (isForecast || false));
    
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
      setSelectedCell({ rowIndex: rowIndex - 1, monthKey, gridType, isForecast });
    } else if (e.key === 'ArrowDown' && rowIndex < gridData.length - 1) {
      e.preventDefault();
      setSelectedCell({ rowIndex: rowIndex + 1, monthKey, gridType, isForecast });
    } else if (e.key === 'ArrowLeft' && currentColIndex > 0) {
      e.preventDefault();
      const prevCol = columns[currentColIndex - 1];
      setSelectedCell({ rowIndex, monthKey: prevCol.monthKey, gridType, isForecast: prevCol.isForecast });
    } else if (e.key === 'ArrowRight' && currentColIndex < columns.length - 1) {
      e.preventDefault();
      const nextCol = columns[currentColIndex + 1];
      setSelectedCell({ rowIndex, monthKey: nextCol.monthKey, gridType, isForecast: nextCol.isForecast });
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (currentColIndex > 0) {
          const prevCol = columns[currentColIndex - 1];
          setSelectedCell({ rowIndex, monthKey: prevCol.monthKey, gridType, isForecast: prevCol.isForecast });
        } else if (rowIndex > 0) {
          const lastCol = columns[columns.length - 1];
          setSelectedCell({ rowIndex: rowIndex - 1, monthKey: lastCol.monthKey, gridType, isForecast: lastCol.isForecast });
        }
      } else {
        if (currentColIndex < columns.length - 1) {
          const nextCol = columns[currentColIndex + 1];
          setSelectedCell({ rowIndex, monthKey: nextCol.monthKey, gridType, isForecast: nextCol.isForecast });
        } else if (rowIndex < gridData.length - 1) {
          const firstCol = columns[0];
          setSelectedCell({ rowIndex: rowIndex + 1, monthKey: firstCol.monthKey, gridType, isForecast: firstCol.isForecast });
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

  const renderCell = (row, monthKey, rowIndex, gridType, isForecastColumn = false) => {
    const isSelected = selectedCell?.rowIndex === rowIndex && selectedCell?.monthKey === monthKey && selectedCell?.gridType === gridType && selectedCell?.isForecast === isForecastColumn;
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.monthKey === monthKey && editingCell?.gridType === gridType && editingCell?.isForecast === isForecastColumn;

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

    // For current month, use separate data for real and forecast
    let records = [];
    if (monthKey === currentMonthKey) {
      // For current month, use the appropriate data source based on column type
      if (isForecastColumn) {
        // Forecast column: use monthDataForecast ONLY
        records = row.monthDataForecast?.[monthKey] || [];
      } else {
        // Real column: use monthData and FILTER OUT any forecast records that might have slipped through
        const allRecords = row.monthData[monthKey] || [];
        records = allRecords.filter(r => !isForecastRecord(r));
      }
    } else {
      // For other months, use monthData (which contains all records)
      records = row.monthData[monthKey] || [];
    }
    const totalAmount = Math.round(records.reduce((sum, r) => sum + Number(r.amount || 0), 0));
    const displayValue = totalAmount !== 0 ? formatMoneyNoDecimals(totalAmount, 'ARS', { sign: 'auto' }) : '-';
    const isForecast = isForecastColumn || (monthKey !== currentMonthKey && isForecastMonth(monthKey, currentMonthKey));

    return (
      <div
        className={`px-1 py-0.5 text-sm text-center ${isSelected ? 'bg-blue-200 dark:bg-blue-800/50' : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'} ${isForecast ? 'opacity-60 italic' : ''}`}
        onClick={() => handleCellClick(rowIndex, monthKey, gridType, isForecastColumn)}
        onDoubleClick={() => handleCellDoubleClick(rowIndex, monthKey, gridType)}
        style={{ minHeight: '20px', cursor: 'default' }}
        title={isForecast ? (t('forecast') || 'Pronóstico') : (t('expandToEditDetails') || 'Expandir para editar detalles individuales')}
      >
        {displayValue}
      </div>
    );
  };

  const renderGrid = (gridData, rowTotals, monthTotals, gridType, title) => {
    const lastPastMonthIndex = getLastPastMonthIndex(months, currentMonthKey);
    
    // Build columns array with current month split into real and forecast
    const columns = [];
    months.forEach((monthKey, index) => {
      if (monthKey === currentMonthKey) {
        // Add real column
        columns.push({ monthKey, isForecast: false, isCurrentMonth: true });
        // Add forecast column
        columns.push({ monthKey, isForecast: true, isCurrentMonth: true });
      } else {
        columns.push({ monthKey, isForecast: false, isCurrentMonth: false });
      }
    });
    
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
              {columns.map((col, index) => {
                const [year, month] = col.monthKey.split('-').map(Number);
                const isLastPastMonth = index === lastPastMonthIndex || (col.isCurrentMonth && !col.isForecast);
                const prevCol = index > 0 ? columns[index - 1] : null;
                const showForecastDivider = col.isCurrentMonth && col.isForecast;
                return (
                  <th
                    key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                    className={`border-2 border-blue-300 dark:border-blue-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
                    style={{ width: 85, minWidth: 85 }}
                    title={`${formatMonthYearLabel(year, month)} ${year}${col.isForecast ? ' (Forecast)' : ' (Real)'}`}
                  >
                    {formatMonthYearLabel(year, month)}{col.isForecast ? ' F' : ''}
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
                    {columns.map((col, index) => {
                      const isLastPastMonth = index === lastPastMonthIndex || (col.isCurrentMonth && !col.isForecast);
                      const showForecastDivider = col.isCurrentMonth && col.isForecast;
                      return (
                        <td
                          key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                          className={`border-r-2 border-gray-300 dark:border-gray-600 p-0 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
                          style={{ width: 85, minWidth: 85 }}
                        >
                          {renderCell(row, col.monthKey, rowIndex, gridType, col.isForecast)}
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
                                  {columns.map((col) => {
                                    const [year, month] = col.monthKey.split('-').map(Number);
                                    const isLastPastMonth = col.isCurrentMonth && !col.isForecast;
                                    const showForecastDivider = col.isCurrentMonth && col.isForecast;
                                    return (
                                      <th
                                        key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                                        className={`border-2 border-indigo-300 dark:border-indigo-700 px-1 py-1 text-center text-xs font-semibold text-gray-800 dark:text-gray-100 bg-indigo-100 dark:bg-indigo-900/40 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
                                        style={{ width: 85, minWidth: 85 }}
                                        title={`${formatMonthYearLabel(year, month)} ${year}${col.isForecast ? ' (Forecast)' : ' (Real)'}`}
                                      >
                                        {formatMonthYearLabel(year, month)}{col.isForecast ? ' F' : ''}
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
                                        {columns.map((col, index) => {
                                          // Find all records for this concept and month
                                          let monthRecords = [];
                                          if (col.isCurrentMonth && col.isForecast) {
                                            monthRecords = concept.records.filter(r => {
                                              const rMonthKey = r.monthKey || `${extractYearMonth(r.date)?.year}-${String(extractYearMonth(r.date)?.month).padStart(2, '0')}`;
                                              return rMonthKey === col.monthKey && isForecastRecord(r);
                                            });
                                          } else {
                                            // Real column or other months
                                            monthRecords = concept.records.filter(r => {
                                              const rMonthKey = r.monthKey || `${extractYearMonth(r.date)?.year}-${String(extractYearMonth(r.date)?.month).padStart(2, '0')}`;
                                              if (rMonthKey !== col.monthKey) return false;
                                              if (col.isCurrentMonth) {
                                                // For current month real column, ONLY show non-forecast records
                                                return !isForecastRecord(r);
                                              }
                                              // For other months, show all records
                                              return true;
                                            });
                                          }
                                          const isForecast = col.isForecast || (col.monthKey !== currentMonthKey && isForecastMonth(col.monthKey, currentMonthKey));
                                          const isLastPastMonth = index === lastPastMonthIndex || (col.isCurrentMonth && !col.isForecast);
                                          const showForecastDivider = col.isCurrentMonth && col.isForecast;
                                          
                                          // Check if this cell is being edited (either has a record being edited, or is an empty cell being edited)
                                          const editingRecord = monthRecords.find(r => editingDetail?.recordId === r.id && editingDetail?.monthKey === col.monthKey);
                                          const isEditingEmpty = editingDetail?.recordId === null && editingDetail?.monthKey === col.monthKey && editingDetail?.conceptLabel === concept.label;
                                          const isEditing = !!editingRecord || isEditingEmpty;
                                          
                                          if (isEditing && (editingRecord || isEditingEmpty)) {
                                            return (
                                              <td
                                                key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                                                className={`border-r-2 border-indigo-200 dark:border-indigo-700 p-0 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
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
                                              key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                                              className={`border-r-2 border-indigo-200 dark:border-indigo-700 px-1 py-1 text-sm text-center hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-cell ${isForecast ? 'opacity-60 italic' : ''} ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
                                              style={{ width: 85, minWidth: 85 }}
                                              onDoubleClick={() => handleDetailDoubleClick(firstRecord || null, col.monthKey, gridType, concept.label, row.key)}
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
                                  {columns.map((col) => {
                                    let monthTotal = 0;
                                    if (col.isCurrentMonth && col.isForecast) {
                                      // Forecast column: sum forecast records for this row (all concepts)
                                      const forecastRecords = row.records.filter(r => {
                                        const rMonthKey = r.monthKey || `${extractYearMonth(r.date)?.year}-${String(extractYearMonth(r.date)?.month).padStart(2, '0')}`;
                                        return rMonthKey === col.monthKey && isForecastRecord(r);
                                      });
                                      monthTotal = forecastRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                    } else {
                                      // Real column or other months: sum real records for this row (all concepts)
                                      const realRecords = row.records.filter(r => {
                                        const rMonthKey = r.monthKey || `${extractYearMonth(r.date)?.year}-${String(extractYearMonth(r.date)?.month).padStart(2, '0')}`;
                                        if (rMonthKey !== col.monthKey) return false;
                                        if (col.isCurrentMonth) {
                                          return !isForecastRecord(r);
                                        }
                                        return true;
                                      });
                                      monthTotal = realRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
                                    }
                                    const isLastPastMonth = col.isCurrentMonth && !col.isForecast;
                                    const showForecastDivider = col.isCurrentMonth && col.isForecast;
                                    return (
                                      <td
                                        key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                                        className={`border-2 border-indigo-400 dark:border-indigo-600 px-1 py-1 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-indigo-200 dark:bg-indigo-900/50 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
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
              {columns.map((col, index) => {
                const isLastPastMonth = index === lastPastMonthIndex || (col.isCurrentMonth && !col.isForecast);
                const showForecastDivider = col.isCurrentMonth && col.isForecast;
                // Calculate total for this column
                let columnTotal = 0;
                if (col.isCurrentMonth && col.isForecast) {
                  // Forecast column: sum forecast records
                  gridData.forEach((row) => {
                    const forecastRecords = row.monthDataForecast?.[col.monthKey] || [];
                    forecastRecords.forEach((record) => {
                      columnTotal += Number(record.amount || 0);
                    });
                  });
                } else {
                  // Real column or other months: sum real records
                  columnTotal = monthTotals.get(col.monthKey) || 0;
                }
                return (
                  <td
                    key={`${col.monthKey}-${col.isForecast ? 'forecast' : 'real'}`}
                    className={`border-2 border-gray-400 dark:border-gray-600 px-1 py-1 text-sm text-center font-bold text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 ${isLastPastMonth ? 'border-r-4 border-r-dashed border-r-gray-500 dark:border-r-gray-400' : ''} ${showForecastDivider ? 'border-l-4 border-l-dashed border-l-gray-500 dark:border-l-gray-400' : ''}`}
                    style={{ width: 85, minWidth: 85 }}
                  >
                    {formatMoneyNoDecimals(Math.round(columnTotal), 'ARS', { sign: 'auto' })}
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
              <label htmlFor="current-month-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mes Actual:
              </label>
              <CustomSelect
                id="current-month-select"
                value={currentMonthKey}
                onChange={(v) => {
                  // Comparar si el nuevo mes es posterior al actual
                  const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number);
                  const [newYear, newMonth] = v.split('-').map(Number);
                  
                  const isMovingForward = newYear > currentYear || (newYear === currentYear && newMonth > currentMonth);
                  
                  if (isMovingForward) {
                    // Mostrar confirmación antes de avanzar
                    setPendingMonthKey(v);
                    setShowMonthChangeConfirm(true);
                  } else {
                    // Permitir retroceder sin confirmación
                    setCurrentMonthKey(v);
                  }
                }}
                options={getAvailableCurrentMonthOptions(currentMonthKey)}
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

      {/* Cell Edit Modal */}
      {cellEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setCellEditModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Editar Celda
                </h3>
                <button
                  onClick={() => setCellEditModal(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-semibold">Categoría:</span> {capitalizeWords(cellEditModal.rowKey)}
                  </p>
                  {cellEditModal.conceptLabel && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="font-semibold">Concepto:</span> {capitalizeWords(cellEditModal.conceptLabel)}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span className="font-semibold">Mes:</span> {cellEditModal.monthKey}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <span className="font-semibold">Valor Actual:</span> {formatMoneyNoDecimals(cellEditModal.currentTotal, 'ARS', { sign: 'auto' })}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Valor</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={modalValue}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9,.-]/g, '');
                      const normalized = cleaned.replace('.', ',');
                      setModalValue(normalized);
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 1000,50"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAction('edit')}
                    className={`h-9 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                      modalAction === 'edit' 
                        ? 'bg-blue-700 dark:bg-blue-800 ring-2 ring-blue-500' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAction('add')}
                    className={`h-9 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                      modalAction === 'add' 
                        ? 'bg-green-700 dark:bg-green-800 ring-2 ring-green-500' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Sumar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAction('subtract')}
                    className={`h-9 px-4 rounded-lg text-white text-sm font-medium transition-colors ${
                      modalAction === 'subtract' 
                        ? 'bg-red-700 dark:bg-red-800 ring-2 ring-red-500' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Restar
                  </button>
                </div>

                {/* Mostrar resultado previo */}
                {modalAction && calculateResultValue() !== null && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {modalAction === 'edit' ? 'Nuevo valor:' : 
                       modalAction === 'add' ? 'Valor resultante (actual + ingresado):' : 
                       'Valor resultante (actual - ingresado):'}
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {formatMoneyNoDecimals(calculateResultValue(), 'ARS', { sign: 'auto' })}
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium mb-1">Nota</label>
                  <textarea
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Agregar nota..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setCellEditModal(null);
                      setModalValue('');
                      setModalNote('');
                      setModalAction(null);
                    }}
                    className="flex-1 h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCellModalSave}
                    disabled={!modalAction}
                    className="flex-1 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de cambio de mes */}
      {showMonthChangeConfirm && pendingMonthKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowMonthChangeConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Confirmar Cambio de Mes
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Estás a punto de cambiar el mes actual a <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {(() => {
                    const [year, month] = pendingMonthKey.split('-').map(Number);
                    return `${getMonthNameInSpanish(month)} ${year}`;
                  })()}
                </span>.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Una vez confirmado, no podrás volver a meses anteriores. ¿Deseas continuar?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowMonthChangeConfirm(false);
                    setPendingMonthKey(null);
                  }}
                  className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setCurrentMonthKey(pendingMonthKey);
                    setShowMonthChangeConfirm(false);
                    setPendingMonthKey(null);
                  }}
                  className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

