import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Card from '../components/Card.jsx';
import { useApp } from '../context/AppContext.jsx';
import { formatMoney, formatMoneyNoDecimals, formatDate, capitalizeWords } from '../utils/format.js';
import * as api from '../api/index.js';
import CustomSelect from '../components/CustomSelect.jsx';

export default function Upload() {
  const { t, refreshExpenses, refreshIncome, categories, expenses } = useApp();
  const { register, handleSubmit, reset, watch } = useForm();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expenseTypeMap, setExpenseTypeMap] = useState({}); // categoryName -> expenseType
  const [showExpenseTypeSelection, setShowExpenseTypeSelection] = useState(false);
  const [newExpenseCategories, setNewExpenseCategories] = useState([]);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchFilter, setSearchFilter] = useState('');
  const selectedFile = watch('file');

  const getErrorMessage = (error) => {
    if (!error) return t('uploadFailed');
    
    const errorMessage = error?.response?.data?.message || error?.message || String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('file size') || lowerMessage.includes('size exceeds') || lowerMessage.includes('tamaño')) {
      return t('errorFileTooLarge');
    }
    if (lowerMessage.includes('only excel') || lowerMessage.includes('allowed') || lowerMessage.includes('formato')) {
      return t('errorInvalidFileFormat');
    }
    if (lowerMessage.includes('empty') || lowerMessage.includes('vacío') || lowerMessage.includes('no sheets')) {
      return t('errorFileEmpty');
    }
    if (lowerMessage.includes('too many rows') || lowerMessage.includes('demasiadas filas')) {
      return t('errorTooManyRows');
    }
    if (lowerMessage.includes('amount and date') || lowerMessage.includes('monto y fecha') || lowerMessage.includes('columns')) {
      return t('errorMissingColumns');
    }
    if (lowerMessage.includes('no file') || lowerMessage.includes('no se subió')) {
      return t('errorNoFile');
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('network')) {
      return t('errorNetwork');
    }
    if (errorMessage && errorMessage.length < 200) {
      return errorMessage;
    }
    return t('uploadFailed');
  };

  // Preview records
  const onFileSelect = async (values) => {
    if (!values.file?.[0]) return;
    setLoading(true);
    setStatus(t('analyzingFile') || 'Analizando tu archivo...');
    
    try {
      const form = new FormData();
      form.append('file', values.file[0]);
      const result = await api.previewExcel(form);
      const records = result.records || [];
      setPreviewData(records);
      
      // Detect expense records that need expenseType selection (all expense records need it)
      const expenseRecords = records.filter(r => r.kind === 'expense');
      
      if (expenseRecords.length > 0) {
        // Create a map of unique concept keys (category + concept) for expenses
        const conceptKeys = expenseRecords.map(r => {
          const cat = (r.categoria || '').toLowerCase();
          const concept = (r.nombre || r.concepto || '').toLowerCase();
          return `${cat}::${concept}`;
        });
        const uniqueConcepts = [...new Set(conceptKeys)];
        setNewExpenseCategories(uniqueConcepts);
        setShowExpenseTypeSelection(true);
        // Initialize expenseTypeMap with MENSUAL as default for each concept
        const initialMap = {};
        uniqueConcepts.forEach(key => {
          initialMap[key] = 'MENSUAL';
        });
        setExpenseTypeMap(initialMap);
      }
      
      let message = '';
      if (records.length === 0) {
        message = 'Advertencia: El archivo se procesó correctamente pero no se encontraron registros válidos.';
      }
      
      // Show errors and warnings from preview
      if (result.errors && result.errors.length > 0) {
        message += message ? '\n\n' : '';
        message += `❌ Errores encontrados durante el análisis (${result.errors.length}):\n`;
        result.errors.slice(0, 10).forEach((err, idx) => {
          const errInfo = err.item || err.category || 'Desconocido';
          const sheetInfo = err.sheet ? ` hoja ${err.sheet}` : '';
          const errMonth = err.month ? ` mes ${err.month}/${err.year || '?'}` : '';
          const errValue = err.value ? ` valor: ${err.value}` : '';
          const errMsg = err.error || err.reason || 'Error desconocido';
          message += `  ${idx + 1}. ${errInfo}${sheetInfo}${errMonth}${errValue}: ${errMsg}\n`;
        });
        if (result.errors.length > 10) {
          message += `  ... y ${result.errors.length - 10} errores más.\n`;
        }
      }
      
      if (result.warnings && result.warnings.length > 0) {
        message += message ? '\n\n' : '';
        message += `Advertencias encontradas durante el análisis (${result.warnings.length}):\n`;
        result.warnings.slice(0, 10).forEach((warn, idx) => {
          const warnInfo = warn.item || warn.category || 'Desconocido';
          const sheetInfo = warn.sheet ? ` hoja ${warn.sheet}` : '';
          const warnMonth = warn.month ? ` mes ${warn.month}/${warn.year || '?'}` : '';
          const warnValue = warn.value ? ` valor: ${warn.value}` : '';
          const warnMsg = warn.reason || 'Advertencia';
          message += `  ${idx + 1}. ${warnInfo}${sheetInfo}${warnMonth}${warnValue}: ${warnMsg}\n`;
        });
        if (result.warnings.length > 10) {
          message += `  ... y ${result.warnings.length - 10} advertencias más.\n`;
        }
      }
      
      if (message) {
        setStatus(message);
      } else {
        setStatus(null);
      }
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecord = (index) => {
    if (!previewData) return;
    const updated = previewData.filter((_, i) => i !== index);
    setPreviewData(updated);
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const handleEditRecord = (index) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index, updatedRecord) => {
    if (!previewData) return;
    const updated = [...previewData];
    // Ensure the date has the selected year
    if (updatedRecord.date) {
      const date = new Date(updatedRecord.date);
      date.setFullYear(selectedYear);
      updatedRecord = { ...updatedRecord, date: date.toISOString() };
    }
    updated[index] = updatedRecord;
    setPreviewData(updated);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleExpenseTypeSelectionComplete = () => {
    setShowExpenseTypeSelection(false);
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.length === 0) {
      setStatus(t('noRecordsToImport'));
      return;
    }
    
    // If there are new expense categories and expenseTypeMap is not complete, show selection
    if (newExpenseCategories.length > 0 && Object.keys(expenseTypeMap).length < newExpenseCategories.length) {
      setShowExpenseTypeSelection(true);
      return;
    }
    
    setLoading(true);
    setStatus(t('uploading'));
    try {
      // Update all records with the selected year
      const updatedRecords = previewData.map(record => {
        if (record.date) {
          const date = new Date(record.date);
          date.setFullYear(selectedYear);
          return { ...record, date: date.toISOString() };
        }
        return record;
      });
      
      const result = await api.confirmImport(updatedRecords, expenseTypeMap);
      let message = result.message || t('importSuccess');
      
      // Build detailed message with errors and warnings
      if (result.errors && result.errors.length > 0) {
        message += `\n\n❌ Errores (${result.errors.length}):\n`;
        result.errors.forEach((err, idx) => {
          const errInfo = err.item || err.category || err.record?.categoryName || err.record?.concept || 'Desconocido';
          const sheetInfo = err.sheet ? ` hoja ${err.sheet}` : '';
          const errMonth = err.month ? ` mes ${err.month}/${err.year || '?'}` : '';
          const errValue = err.value ? ` valor: ${err.value}` : '';
          const errMsg = err.error || err.reason || 'Error desconocido';
          message += `  ${idx + 1}. ${errInfo}${sheetInfo}${errMonth}${errValue}: ${errMsg}\n`;
        });
      }
      
      if (result.warnings && result.warnings.length > 0) {
        message += `\nAdvertencias (${result.warnings.length}):\n`;
        result.warnings.forEach((warn, idx) => {
          const warnInfo = warn.item || warn.category || 'Desconocido';
          const sheetInfo = warn.sheet ? ` hoja ${warn.sheet}` : '';
          const warnMonth = warn.month ? ` mes ${warn.month}/${warn.year || '?'}` : '';
          const warnValue = warn.value ? ` valor: ${warn.value}` : '';
          const warnMsg = warn.reason || 'Advertencia';
          message += `  ${idx + 1}. ${warnInfo}${sheetInfo}${warnMonth}${warnValue}: ${warnMsg}\n`;
        });
      }
      
      setStatus(message);
      setPreviewData(null);
      reset();
      await Promise.all([
        refreshExpenses(),
        refreshIncome(),
      ]);
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreviewData(null);
    setEditingIndex(null);
    setStatus(null);
    setSortColumn(null);
    setSortDirection('asc');
    setSearchFilter('');
    reset();
  };

  const [monthlySummaryFile, setMonthlySummaryFile] = useState(null);
  const [monthlySummaryResults, setMonthlySummaryResults] = useState(null);
  const [showMonthlySummaryForm, setShowMonthlySummaryForm] = useState(false);
  const [editingMonthlyRecord, setEditingMonthlyRecord] = useState(null);
  const editingRowRef = useRef(null);
  const [failedSections, setFailedSections] = useState([]); // Array de { index, title, content, error }
  const [monthlySummaryYear, setMonthlySummaryYear] = useState(new Date().getFullYear());
  const [monthlySummaryMonth, setMonthlySummaryMonth] = useState(new Date().getMonth() + 1);
  const [selectedBank, setSelectedBank] = useState(null); // { categoryId, concept }
  
  // Obtener conceptos únicos de la categoría "mantenimiento bancos"
  const bankConcepts = useMemo(() => {
    const bankCategory = categories.find(cat => 
      cat.name.toLowerCase() === 'mantenimiento bancos' || 
      cat.name.toLowerCase() === 'mantenimiento banco'
    );
    
    if (!bankCategory) return [];
    
    // Buscar todos los conceptos únicos (expenses) que pertenecen a esta categoría
    const bankExpenses = expenses.filter(exp => exp.categoryId === bankCategory.id);
    const uniqueConcepts = [...new Set(bankExpenses.map(exp => exp.concept).filter(Boolean))];
    
    return uniqueConcepts.map(concept => ({
      concept,
      categoryId: bankCategory.id,
      categoryName: bankCategory.name,
    }));
  }, [categories, expenses]);

  // Listener para cerrar la edición cuando se hace click fuera del área de edición
  useEffect(() => {
    if (editingMonthlyRecord === null) return;
    
    const handleClickOutside = (event) => {
      if (editingRowRef.current) {
        const clickedInside = editingRowRef.current.contains(event.target);
        // También verificar si el click fue en el dropdown del CustomSelect o en el botón
        const dropdown = document.querySelector('[data-custom-select-dropdown]');
        const clickedInDropdown = dropdown && dropdown.contains(event.target);
        // Verificar si el click fue en el contenedor del CustomSelect o en cualquier elemento relacionado
        const customSelectContainer = event.target.closest('[data-custom-select-container]');
        const clickedInCustomSelect = customSelectContainer !== null;
        // Verificar si el click fue en el contenedor principal del CustomSelect (el div con ref selectRef)
        const customSelectDiv = event.target.closest('.relative');
        const isCustomSelectParent = customSelectDiv && customSelectDiv.querySelector('button[type="button"]');
        
        // Solo cerrar si el click fue completamente fuera del área de edición y del CustomSelect
        if (!clickedInside && !clickedInDropdown && !clickedInCustomSelect && !isCustomSelectParent) {
          setEditingMonthlyRecord(null);
        }
      }
    };
    
    // Agregar listener con un delay para evitar conflictos con el click que abrió la edición
    // El delay permite que el CustomSelect procese primero su evento
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 150);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [editingMonthlyRecord]);

  const handleLoadMonthlySummary = async () => {
    if (!monthlySummaryFile) {
      setStatus('Por favor selecciona un archivo PDF');
      return;
    }
    
    if (!selectedBank) {
      setStatus('Por favor selecciona un banco antes de procesar');
      return;
    }

    setLoading(true);
    setStatus('Analizando PDF y dividiendo en secciones...');
    setFailedSections([]); // Limpiar errores previos
    try {
      // Primero obtener las secciones
      const sectionsResult = await api.getMonthlySummarySections(monthlySummaryFile);
      const sections = sectionsResult.sections;
      
      if (!sections || sections.length === 0) {
        setStatus('No se encontraron secciones en el PDF');
        setLoading(false);
        return;
      }

      setStatus(`Procesando ${sections.length} secciones automáticamente...`);
      
      // Procesar todas las secciones automáticamente
      const allRecords = [];
      let successCount = 0;
      let errorCount = 0;
      const newFailedSections = [];

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        try {
          setStatus(`Procesando sección ${i + 1}/${sections.length}: ${section.title}...`);

          const result = await api.processMonthlySummarySection(
            section.content,
            section.title,
            selectedBank
          );

          if (result.records && Array.isArray(result.records)) {
            allRecords.push(...result.records);
          }
          
          // Mostrar información sobre mantenimientos de bancos si existe
          if (result.consolidatedTaxesRecord) {
            const taxesRecord = result.consolidatedTaxesRecord;
            const taxesMessage = `💰 Mantenimientos de bancos: Se consolidaron registros de "Impuestos, cargos e intereses" en ${taxesRecord.categoryName} - ${taxesRecord.concept} por ${formatMoneyNoDecimals(taxesRecord.amount, taxesRecord.currency || 'ARS', { sign: 'auto' })}`;
            setStatus(`Procesando sección ${i + 1}/${sections.length}: ${section.title}...\n${taxesMessage}`);
          }
          
          successCount++;
        } catch (e) {
          errorCount++;
          const errorMsg = getErrorMessage(e);
          
          // Intentar parsear el error para obtener detalles
          let errorDetails = errorMsg;
          try {
            const errorResponse = e?.response?.data?.message;
            if (errorResponse) {
              const parsed = JSON.parse(errorResponse);
              errorDetails = parsed.error || errorMsg;
            }
          } catch (parseError) {
            // Si no se puede parsear, usar el mensaje original
          }
          
          console.error(`Error procesando sección ${i + 1}:`, errorDetails);
          
          // Guardar información de la sección fallida
          newFailedSections.push({
            index: i,
            title: section.title || `Sección ${i + 1}`,
            content: section.content,
            error: errorDetails,
            originalIndex: section.index,
          });
        }
      }

      // Guardar secciones fallidas
      setFailedSections(newFailedSections);

      // Contar registros de mantenimientos de bancos consolidados
      const bankMaintenanceRecords = allRecords.filter(r => r.isTaxesSection === true && r.note && r.note.includes('consolidados'));
      const bankMaintenanceTotal = bankMaintenanceRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
      
      // Combinar todos los resultados
      setMonthlySummaryResults({
        records: allRecords,
        unmappedItems: [],
        message: `Se procesaron ${allRecords.length} registros de ${successCount} secciones${errorCount > 0 ? ` (${errorCount} con errores)` : ''}.`,
      });
      
      setShowMonthlySummaryForm(false);
      setMonthlySummaryFile(null);
      
      // Construir mensaje final con información de mantenimientos de bancos
      let finalMessage = '';
      if (errorCount === 0) {
        finalMessage = `✓ Procesamiento completado: ${allRecords.length} registros encontrados en ${successCount} secciones`;
      } else {
        finalMessage = `Procesamiento completado: ${allRecords.length} registros de ${successCount} secciones exitosas, ${errorCount} secciones con errores (puedes reanalizarlas)`;
      }
      
      if (bankMaintenanceRecords.length > 0) {
        const bankCategory = bankMaintenanceRecords[0]?.categoryName || 'mantenimiento bancos';
        const bankConcept = bankMaintenanceRecords[0]?.concept || '';
        finalMessage += `\n\n💰 Mantenimientos de bancos: Se consolidaron ${bankMaintenanceRecords.length} registro(s) de "Impuestos, cargos e intereses" en ${bankCategory} - ${bankConcept} por un total de ${formatMoneyNoDecimals(bankMaintenanceTotal, 'ARS', { sign: 'auto' })}.`;
      }
      
      setStatus(finalMessage);
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySection = async (failedSection) => {
    setLoading(true);
    setStatus(`Reanalizando sección: ${failedSection.title}...`);
    
    try {
      const result = await api.processMonthlySummarySection(
        failedSection.content,
        failedSection.title
      );

      if (result.records && Array.isArray(result.records)) {
        // Agregar los nuevos registros a los resultados existentes
        setMonthlySummaryResults(prev => ({
          ...prev,
          records: [...(prev?.records || []), ...result.records],
          message: `Se agregaron ${result.records.length} registros de la sección "${failedSection.title}".`,
        }));

        // Remover la sección de las fallidas
        setFailedSections(prev => prev.filter(s => s.index !== failedSection.index));
        
        setStatus(`✓ Sección "${failedSection.title}" procesada exitosamente: ${result.records.length} registros agregados`);
      }
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      let errorDetails = errorMsg;
      try {
        const errorResponse = e?.response?.data?.message;
        if (errorResponse) {
          const parsed = JSON.parse(errorResponse);
          errorDetails = parsed.error || errorMsg;
        }
      } catch (parseError) {
        // Si no se puede parsear, usar el mensaje original
      }
      
      // Actualizar el error de la sección
      setFailedSections(prev => prev.map(s => 
        s.index === failedSection.index 
          ? { ...s, error: errorDetails }
          : s
      ));
      
      setStatus(`Error al reanalizar sección "${failedSection.title}": ${errorDetails}`);
    } finally {
      setLoading(false);
    }
  };


  const handleEditMonthlyRecord = (index) => {
    setEditingMonthlyRecord(index);
  };

  const handleSaveMonthlyRecord = (index, updatedRecord, keepEditing = false) => {
    if (!monthlySummaryResults) return;
    const updated = [...monthlySummaryResults.records];
    updated[index] = updatedRecord;
    setMonthlySummaryResults({ ...monthlySummaryResults, records: updated });
    if (!keepEditing) {
      setEditingMonthlyRecord(null);
    }
  };

  const handleUpdateMonthlyRecordConcept = (index, concept) => {
    if (!monthlySummaryResults) return;
    const updated = [...monthlySummaryResults.records];
    updated[index] = { ...updated[index], concept };
    setMonthlySummaryResults({ ...monthlySummaryResults, records: updated });
    // No cerrar el modo de edición, solo actualizar el valor
  };

  const handleConfirmAll = () => {
    if (!monthlySummaryResults) return;
    const updated = monthlySummaryResults.records.map(record => {
      const mappingStatus = record.mappingStatus || (record.needsManualMapping ? 'needs_mapping' : (!record.categoryId || !record.concept ? 'needs_mapping' : 'ready'));
      if (mappingStatus === 'needs_confirmation') {
        return { ...record, mappingStatus: 'ready' };
      }
      return record;
    });
    setMonthlySummaryResults({ ...monthlySummaryResults, records: updated });
  };

  const handleRemoveMonthlyRecord = (index) => {
    if (!monthlySummaryResults) return;
    const updated = monthlySummaryResults.records.filter((_, i) => i !== index);
    setMonthlySummaryResults({ ...monthlySummaryResults, records: updated });
    if (editingMonthlyRecord === index) {
      setEditingMonthlyRecord(null);
    } else if (editingMonthlyRecord > index) {
      setEditingMonthlyRecord(editingMonthlyRecord - 1);
    }
  };

  const handleConfirmMonthlyImport = async () => {
    if (!monthlySummaryResults || !monthlySummaryResults.records || monthlySummaryResults.records.length === 0) {
      setStatus('No hay registros para importar');
      return;
    }

    setLoading(true);
    setStatus('Importando registros...');
    try {
      // Filtrar solo los registros que necesitan mapeo (no se pueden importar sin concepto)
      const unmappedRecords = monthlySummaryResults.records.filter(r => r.mappingStatus === 'needs_mapping' || !r.categoryId || !r.concept);

      if (unmappedRecords.length > 0) {
        setStatus(`Hay ${unmappedRecords.length} registros que requieren mapeo manual. Por favor, completa la información antes de importar.`);
        setLoading(false);
        return;
      }

      // Convertir a formato de confirmImport y aplicar fecha seleccionada
      const recordsToImport = monthlySummaryResults.records.map(r => {
        // Crear fecha con el año y mes seleccionados
        const selectedDate = new Date(monthlySummaryYear, monthlySummaryMonth - 1, 1);
        // Si el registro tiene una fecha original, usar el día de esa fecha, sino usar día 1
        let day = 1;
        if (r.date) {
          const originalDate = new Date(r.date);
          day = originalDate.getDate();
        }
        selectedDate.setDate(day);
        
        return {
          kind: r.kind,
          categoria: r.categoryName || categories.find(c => c.id === r.categoryId)?.name || '',
          nombre: r.concept || '',
          amount: r.amount || 0,
          date: selectedDate.toISOString(),
          currency: r.currency || 'ARS',
          nota: r.note || '',
        };
      });

      const result = await api.confirmImport(recordsToImport, {});
      setStatus(result.message || 'Importación completada exitosamente');
      setMonthlySummaryResults(null);
      await Promise.all([refreshExpenses(), refreshIncome()]);
    } catch (e) {
      const errorMsg = getErrorMessage(e);
      setStatus(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get expense type label
  const getExpenseTypeLabel = (expenseType) => {
    const labels = {
      'MENSUAL': 'Mensual',
      'SEMESTRAL': 'Semestral',
      'ANUAL': 'Anual',
      'EXCEPCIONAL': 'Excepcional'
    };
    return labels[expenseType] || expenseType;
  };

  // Helper function to get expense type for a record
  const getRecordExpenseType = (record) => {
    if (record.kind !== 'expense') return null;
    const cat = (record.categoria || '').toLowerCase();
    const concept = (record.nombre || '').toLowerCase();
    const key = `${cat}::${concept}`;
    return expenseTypeMap?.[key] || null;
  };

  // Filter and sort preview data
  const filteredAndSortedData = useMemo(() => {
    if (!previewData) return [];

    // Apply year adjustment and filters, preserving original index
    let processed = previewData.map((record, originalIndex) => {
      const previewRecord = record.date ? {
        ...record,
        date: (() => {
          const date = new Date(record.date);
          date.setFullYear(selectedYear);
          return date.toISOString();
        })()
      } : record;
      return { ...previewRecord, _originalIndex: originalIndex };
    });

    // Apply search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      processed = processed.filter((record) => {
        // Search in type
        if (record.kind?.toLowerCase().includes(searchLower)) return true;
        // Search in category
        if ((record.categoria || '').toLowerCase().includes(searchLower)) return true;
        // Search in concept
        if ((record.nombre || '').toLowerCase().includes(searchLower)) return true;
        // Search in amount
        if (String(record.amount || '').includes(searchFilter)) return true;
        // Search in date
        if (formatDate(record.date).toLowerCase().includes(searchLower)) return true;
        // Search in temporalidad
        const expenseType = getRecordExpenseType(record);
        const typeLabel = expenseType ? getExpenseTypeLabel(expenseType) : '';
        return typeLabel.toLowerCase().includes(searchLower);
      });
    }

    // Apply sorting
    if (sortColumn) {
      processed = [...processed].sort((a, b) => {
        let aVal, bVal;
        
        switch (sortColumn) {
          case 'type':
            aVal = a.kind || '';
            bVal = b.kind || '';
            break;
          case 'category':
            aVal = (a.categoria || '').toLowerCase();
            bVal = (b.categoria || '').toLowerCase();
            break;
          case 'concept':
            aVal = (a.nombre || '').toLowerCase();
            bVal = (b.nombre || '').toLowerCase();
            break;
          case 'amount':
            aVal = Number(a.amount || 0);
            bVal = Number(b.amount || 0);
            break;
          case 'date':
            aVal = a.date ? new Date(a.date).getTime() : 0;
            bVal = b.date ? new Date(b.date).getTime() : 0;
            break;
          case 'temporalidad':
            aVal = getExpenseTypeLabel(getRecordExpenseType(a)) || '';
            bVal = getExpenseTypeLabel(getRecordExpenseType(b)) || '';
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return processed;
  }, [previewData, selectedYear, searchFilter, sortColumn, sortDirection, expenseTypeMap]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">{t('uploadTitle')}</p>
        <p className="text-[#616f89] dark:text-gray-400 mb-4">
          Tenés dos opciones para importar tus datos:
        </p>
        <div className="space-y-2 text-sm text-[#616f89] dark:text-gray-400">
          <p>
            <strong className="text-gray-800 dark:text-gray-200">1. Importar desde Excel/CSV:</strong> Ideal para importar registros individuales de gastos e ingresos con fechas específicas. El sistema detecta automáticamente el año según el nombre de cada hoja del archivo.
          </p>
          <p>
            <strong className="text-gray-800 dark:text-gray-200">2. Cargar Resumen mensual (PDF):</strong> Perfecto para importar resúmenes bancarios mensuales en PDF. Usa inteligencia artificial para identificar automáticamente categorías y conceptos de tus gastos e ingresos consolidados por mes.
          </p>
        </div>
      </header>

      {!previewData ? (
        <>
          <Card>
            <div className="mb-4">
              <p className="text-xl font-bold mb-2">1. Importar desde Excel o CSV</p>
              <p className="text-sm text-[#616f89] dark:text-gray-400">
                Subí un archivo Excel (.xlsx) o CSV con tus registros individuales de gastos e ingresos. Cada registro debe tener una fecha específica. El sistema detecta automáticamente el año según el nombre de cada hoja del archivo.
              </p>
            </div>
            <form onSubmit={handleSubmit(onFileSelect)} className="flex flex-col gap-4">
              <input 
                type="file" 
                accept=".xlsx,.csv" 
                className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white hover:file:bg-primary/90" 
                {...register('file')} 
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('uploadSheetYearHint') || 'Detectamos automáticamente el año según el nombre de cada hoja del archivo.'}
              </p>
              <div className="flex justify-end">
                <button 
                  disabled={loading || !selectedFile?.[0]} 
                  className="h-12 px-5 rounded-lg bg-primary text-white font-bold disabled:opacity-50"
                >
                  {loading ? (t('analyzingFile') || 'Analizando...') : (t('analyzeFile') || 'Analizar archivo')}
                </button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xl font-bold mb-2">2. Cargar Resumen mensual desde PDF</p>
                <p className="text-sm text-[#616f89] dark:text-gray-400">
                  Subí un resumen bancario mensual en formato PDF (por ejemplo, resúmenes de cuenta de tu banco). El sistema usa inteligencia artificial para extraer automáticamente los gastos e ingresos, identificar categorías y conceptos, y consolidarlos por mes. Ideal para importar varios meses de una vez desde documentos bancarios.
                </p>
              </div>
              {!showMonthlySummaryForm ? (
                <div className="flex justify-end">
                  <button 
                    onClick={() => setShowMonthlySummaryForm(true)}
                    disabled={loading}
                    className="h-12 px-5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700"
                  >
                    Cargar Resumen mensual
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Archivo PDF</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setMonthlySummaryFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-700"
                      disabled={loading}
                    />
                    {monthlySummaryFile && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Archivo seleccionado: {monthlySummaryFile.name}
                      </p>
                    )}
                  </div>
                  
                  {bankConcepts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Banco <span className="text-red-500">*</span>
                      </label>
                      <CustomSelect
                        value={selectedBank?.concept || ''}
                        onChange={(value) => {
                          const bank = bankConcepts.find(b => b.concept === value);
                          setSelectedBank(bank || null);
                        }}
                        options={[
                          { value: '', label: 'Seleccione un banco...' },
                          ...bankConcepts.map(bank => ({
                            value: bank.concept,
                            label: capitalizeWords(bank.concept),
                          })),
                        ]}
                        disabled={loading}
                      />
                      {!selectedBank && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                          Debe seleccionar un banco antes de procesar
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button 
                      onClick={() => {
                        setShowMonthlySummaryForm(false);
                        setMonthlySummaryFile(null);
                      }}
                      disabled={loading}
                      className="h-12 px-5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleLoadMonthlySummary}
                      disabled={loading || !monthlySummaryFile || !selectedBank}
                      className="h-12 px-5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50 hover:bg-indigo-700"
                    >
                      {loading ? 'Procesando...' : 'Procesar con IA'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>

        </>
      ) : showExpenseTypeSelection ? (
        <Card>
          <div className="mb-4">
            <p className="text-2xl font-bold">Seleccionar tipo de gasto</p>
            <p className="text-sm text-[#616f89] dark:text-gray-400">
              Selecciona el tipo de gasto para cada concepto. Esto se usará para el forecast.
            </p>
          </div>
          <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-visible">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_200px] gap-4 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Categoría</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Concepto</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Temporalidad</div>
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-visible">
              {newExpenseCategories.map((conceptKey) => {
                const [categoryName, conceptName] = conceptKey.split('::');
                return (
                  <div key={conceptKey} className="grid grid-cols-[1fr_1fr_200px] gap-4 p-3 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 relative">
                    <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {capitalizeWords(categoryName)}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {capitalizeWords(conceptName)}
                    </div>
                    <div className="flex-shrink-0 relative z-10">
                      <CustomSelect
                        value={expenseTypeMap[conceptKey] || 'MENSUAL'}
                        onChange={(value) => setExpenseTypeMap(prev => ({ ...prev, [conceptKey]: value }))}
                        options={[
                          { value: 'MENSUAL', label: 'Mensual' },
                          { value: 'SEMESTRAL', label: 'Semestral' },
                          { value: 'ANUAL', label: 'Anual' },
                          { value: 'EXCEPCIONAL', label: 'Excepcional' },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowExpenseTypeSelection(false);
                setExpenseTypeMap({});
                setNewExpenseCategories([]);
              }}
              className="h-12 px-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExpenseTypeSelectionComplete}
              className="h-12 px-8 rounded-lg bg-primary text-white font-bold hover:bg-primary/90 transition-colors"
            >
              Continuar
            </button>
          </div>
        </Card>
      ) : previewData ? (
        <div className="flex flex-col gap-6 pb-24">
          <Card>
            <div className="mb-4">
              <p className="text-2xl font-bold">{t('previewTitle')}</p>
              <p className="text-sm text-[#616f89] dark:text-gray-400">{t('previewSubtitle')}</p>
            </div>
            <div className="mb-4 flex items-center gap-4">
              <div className="text-sm">
                <strong>{t('previewRecords')}:</strong> {previewData.length}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="year-select" className="text-sm font-semibold">
                  {t('year') || 'Año'}:
                </label>
                <CustomSelect
                  id="year-select"
                  value={String(selectedYear)}
                  onChange={(v) => setSelectedYear(Number(v))}
                  options={Array.from({ length: 2100 - 1980 + 1 }, (_, i) => {
                    const year = 1980 + i;
                    return { value: String(year), label: String(year) };
                  })}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('uploadYearHint') || 'Todas las fechas se ajustarán a este año'}
                </p>
              </div>
            </div>
          </Card>

          {previewData.length > 0 ? (
            <Card>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">search</span>
                  <input
                    type="text"
                    placeholder="Buscar en todas las columnas..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      className="px-2 py-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[calc(100vh-300px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('type')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {t('type')}
                          {sortColumn === 'type' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('category')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {t('category')}
                          {sortColumn === 'category' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('concept')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {t('concept') || 'Concepto'}
                          {sortColumn === 'concept' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('amount')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {t('amount')}
                          {sortColumn === 'amount' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('date')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {t('date')}
                          {sortColumn === 'date' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">
                        <button
                          onClick={() => handleSort('temporalidad')}
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          Temporalidad
                          {sortColumn === 'temporalidad' && (
                            <span className="material-symbols-outlined text-xs">
                              {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                            </span>
                          )}
                        </button>
                      </th>
                      <th className="text-left p-2">{t('edit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedData.map((record, index) => {
                      const originalIndex = record._originalIndex ?? index;
                      // Remove _originalIndex from record before passing to RecordRow
                      const { _originalIndex, ...cleanRecord } = record;
                      return (
                        <RecordRow
                          key={`${originalIndex}-${index}`}
                          record={cleanRecord}
                          index={originalIndex}
                          isEditing={editingIndex === originalIndex}
                          onEdit={handleEditRecord}
                          onSave={handleSaveEdit}
                          onCancel={handleCancelEdit}
                          onRemove={handleRemoveRecord}
                          expenseTypeMap={expenseTypeMap}
                          onExpenseTypeChange={(key, value) => {
                            setExpenseTypeMap(prev => ({ ...prev, [key]: value }));
                          }}
                          t={t}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-[#616f89] dark:text-gray-400">{t('noRecordsToImport')}</p>
            </Card>
          )}

          {/* Fixed bottom action bar */}
          <div className="fixed bottom-0 left-64 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg z-50">
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="h-12 px-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('cancelImport')}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading || previewData.length === 0 || showExpenseTypeSelection}
                className="h-12 px-8 rounded-lg bg-primary text-white font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? t('uploading') : t('confirmImport')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {monthlySummaryResults && monthlySummaryResults.records && (
        <div className="flex flex-col gap-6 pb-24">
          <Card>
            <div className="mb-4">
              <p className="text-2xl font-bold">Resultados del Resumen Mensual</p>
              <p className="text-sm text-[#616f89] dark:text-gray-400">
                Revisa y completa la información de los registros. Los que requieren mapeo manual deben ser editados antes de importar.
              </p>
            </div>
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              <p className="text-sm">
                <strong>Total registros:</strong> {monthlySummaryResults.records.length} | 
                <strong className="ml-2 text-green-600 dark:text-green-400">Listos:</strong> {monthlySummaryResults.records.filter(r => r.mappingStatus === 'ready').length} | 
                <strong className="ml-2 text-yellow-600 dark:text-yellow-400">Necesitan confirmación:</strong> {monthlySummaryResults.records.filter(r => r.mappingStatus === 'needs_confirmation').length} | 
                <strong className="ml-2 text-red-600 dark:text-red-400">Necesitan mapeo:</strong> {monthlySummaryResults.records.filter(r => r.mappingStatus === 'needs_mapping' || !r.categoryId || !r.concept).length}
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="monthly-year-select" className="text-sm font-semibold">
                  Año:
                </label>
                <CustomSelect
                  id="monthly-year-select"
                  value={String(monthlySummaryYear)}
                  onChange={(v) => setMonthlySummaryYear(Number(v))}
                  options={Array.from({ length: 2100 - 1980 + 1 }, (_, i) => {
                    const year = 1980 + i;
                    return { value: String(year), label: String(year) };
                  })}
                />
                <label htmlFor="monthly-month-select" className="text-sm font-semibold ml-2">
                  Mes:
                </label>
                <CustomSelect
                  id="monthly-month-select"
                  value={String(monthlySummaryMonth)}
                  onChange={(v) => setMonthlySummaryMonth(Number(v))}
                  options={[
                    { value: '1', label: 'Enero' },
                    { value: '2', label: 'Febrero' },
                    { value: '3', label: 'Marzo' },
                    { value: '4', label: 'Abril' },
                    { value: '5', label: 'Mayo' },
                    { value: '6', label: 'Junio' },
                    { value: '7', label: 'Julio' },
                    { value: '8', label: 'Agosto' },
                    { value: '9', label: 'Septiembre' },
                    { value: '10', label: 'Octubre' },
                    { value: '11', label: 'Noviembre' },
                    { value: '12', label: 'Diciembre' },
                  ]}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Todas las fechas se ajustarán a este año/mes
                </p>
              </div>
            </div>
          </Card>

          {monthlySummaryResults.records.length > 0 ? (
            <Card>
              <div className="mb-4 flex justify-between items-center">
                <div className="text-sm">
                  <strong className="text-green-600 dark:text-green-400">Listos:</strong> {monthlySummaryResults.records.filter(r => {
                    const mappingStatus = r.mappingStatus || (r.needsManualMapping ? 'needs_mapping' : (!r.categoryId || !r.concept ? 'needs_mapping' : 'ready'));
                    return mappingStatus === 'ready';
                  }).length} | 
                  <strong className="ml-2 text-yellow-600 dark:text-yellow-400">Necesitan confirmación:</strong> {monthlySummaryResults.records.filter(r => {
                    const mappingStatus = r.mappingStatus || (r.needsManualMapping ? 'needs_mapping' : (!r.categoryId || !r.concept ? 'needs_mapping' : 'ready'));
                    return mappingStatus === 'needs_confirmation';
                  }).length} | 
                  <strong className="ml-2 text-red-600 dark:text-red-400">Necesitan mapeo:</strong> {monthlySummaryResults.records.filter(r => {
                    const mappingStatus = r.mappingStatus || (r.needsManualMapping ? 'needs_mapping' : (!r.categoryId || !r.concept ? 'needs_mapping' : 'ready'));
                    return mappingStatus === 'needs_mapping' || !r.categoryId || !r.concept;
                  }).length}
                </div>
                {monthlySummaryResults.records.some(r => {
                  const mappingStatus = r.mappingStatus || (r.needsManualMapping ? 'needs_mapping' : (!r.categoryId || !r.concept ? 'needs_mapping' : 'ready'));
                  return mappingStatus === 'needs_confirmation';
                }) && (
                  <button
                    onClick={handleConfirmAll}
                    className="h-10 px-4 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-colors"
                  >
                    Confirmar Todos
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-left p-2">Categoría</th>
                      <th className="text-left p-2">Concepto</th>
                      <th className="text-right p-2">Monto</th>
                      <th className="text-left p-2">Texto Original</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummaryResults.records.map((record, index) => {
                      const mappingStatus = record.mappingStatus || (record.needsManualMapping ? 'needs_mapping' : (!record.categoryId || !record.concept ? 'needs_mapping' : 'ready'));
                      const needsMapping = mappingStatus === 'needs_mapping' || !record.categoryId || !record.concept;
                      const needsConfirmation = mappingStatus === 'needs_confirmation';
                      const category = categories.find(c => c.id === record.categoryId);
                      return (
                        <tr 
                          key={index} 
                          ref={editingMonthlyRecord === index ? editingRowRef : null}
                          className={`border-b border-gray-100 dark:border-gray-800 ${
                            needsMapping ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 
                            needsConfirmation ? 'bg-yellow-50 dark:bg-yellow-900/20' : 
                            'bg-white dark:bg-gray-900'
                          }`}
                          onClick={(e) => {
                            // Si estamos editando este registro, no permitir que clicks en la fila cierren la edición
                            if (editingMonthlyRecord === index) {
                              e.stopPropagation();
                            }
                          }}
                        >
                          <td className="py-2 px-3 whitespace-nowrap">{record.kind === 'income' ? 'Ingreso' : 'Gasto'}</td>
                          <td className="py-2 px-3 break-words" onClick={(e) => editingMonthlyRecord === index && e.stopPropagation()} onMouseDown={(e) => editingMonthlyRecord === index && e.stopPropagation()}>
                            {editingMonthlyRecord === index ? (
                              <div 
                                onClick={(e) => e.stopPropagation()} 
                                onMouseDown={(e) => e.stopPropagation()}
                                data-custom-select-container="true"
                              >
                                <CustomSelect
                                  value={record.categoryId || ''}
                                  onChange={(v) => {
                                    const selectedCat = categories.find(c => c.id === v);
                                    handleSaveMonthlyRecord(index, {
                                      ...record,
                                      categoryId: v,
                                      categoryName: selectedCat?.name || record.categoryName,
                                      mappingStatus: 'ready',
                                    }, true); // Mantener el modo de edición abierto
                                  }}
                                  options={[
                                    { value: '', label: 'Seleccionar...' },
                                    ...categories
                                      .filter(c => c.type.name.toLowerCase() === record.kind)
                                      .map(cat => ({ value: cat.id, label: capitalizeWords(cat.name) }))
                                  ]}
                                  className="w-full"
                                />
                              </div>
                            ) : (
                              <span className={needsMapping ? 'text-yellow-600 dark:text-yellow-400' : ''}>
                                {category ? capitalizeWords(category.name) : record.categoryName || 'Sin categoría'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 break-words" onClick={(e) => editingMonthlyRecord === index && e.stopPropagation()} onMouseDown={(e) => editingMonthlyRecord === index && e.stopPropagation()}>
                            {editingMonthlyRecord === index ? (
                              <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={record.concept || ''}
                                  onChange={(e) => handleUpdateMonthlyRecordConcept(index, e.target.value)}
                                  // Removido onBlur - ahora se maneja con el listener de click fuera del área
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      setEditingMonthlyRecord(null);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingMonthlyRecord(null);
                                    }
                                  }}
                                  className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              record.concept || '-'
                            )}
                          </td>
                          <td className="text-right py-2 px-3 whitespace-nowrap">
                            {formatMoneyNoDecimals(record.amount || 0, record.currency || 'ARS', { sign: 'auto' })}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            <div className="break-words" title={record.originalText || ''}>
                              {record.originalText || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {needsMapping ? (
                              <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-semibold">
                                Necesita Mapeo
                              </span>
                            ) : needsConfirmation ? (
                              <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-semibold">
                                Necesita Confirmación
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-semibold">
                                Listo
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex gap-2">
                              {editingMonthlyRecord === index ? (
                                <button
                                  onClick={() => setEditingMonthlyRecord(null)}
                                  className="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
                                >
                                  Guardar
                                </button>
                              ) : (
                                <>
                                  {needsConfirmation && (
                                    <button
                                      onClick={() => handleSaveMonthlyRecord(index, { ...record, mappingStatus: 'ready' })}
                                      className="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
                                      title="Confirmar mapeo"
                                    >
                                      Confirmar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditMonthlyRecord(index)}
                                    className="px-2 py-1 rounded bg-primary/10 text-primary dark:bg-primary/20 text-xs hover:bg-primary/20"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMonthlyRecord(index)}
                                    className="px-2 py-1 rounded bg-red-500/10 text-red-500 dark:bg-red-500/20 text-xs hover:bg-red-500/20"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {monthlySummaryResults.unmappedItems && monthlySummaryResults.unmappedItems.length > 0 && (
            <Card>
              <div className="mb-4">
                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">Items sin mapear</p>
                <p className="text-sm text-[#616f89] dark:text-gray-400">
                  Estos items no pudieron ser asociados automáticamente. Puedes agregarlos manualmente.
                </p>
              </div>
              <div className="space-y-2">
                {monthlySummaryResults.unmappedItems.map((item, index) => (
                  <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm font-semibold">{item.originalText}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {item.kind === 'income' ? 'Ingreso' : 'Gasto'} - 
                      Sugerencia: {item.suggestedCategory} / {item.suggestedConcept} - 
                      Monto: {formatMoneyNoDecimals(item.amount || 0, 'ARS', { sign: 'auto' })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="fixed bottom-0 left-64 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg z-50">
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setMonthlySummaryResults(null);
                  setStatus(null);
                }}
                disabled={loading}
                className="h-12 px-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmMonthlyImport}
                disabled={loading || monthlySummaryResults.records.filter(r => r.needsManualMapping || !r.categoryId).length > 0}
                className="h-12 px-8 rounded-lg bg-primary text-white font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {loading ? 'Importando...' : 'Confirmar Importación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {failedSections.length > 0 && (
        <Card>
          <div className="mb-4">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              Secciones con errores ({failedSections.length})
            </p>
            <p className="text-sm text-[#616f89] dark:text-gray-400">
              Algunas secciones no pudieron procesarse. Puedes intentar reanalizarlas individualmente.
            </p>
          </div>
          <div className="space-y-3">
            {failedSections.map((failedSection) => (
              <div 
                key={failedSection.index} 
                className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {failedSection.title}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                      <strong>Error:</strong> {failedSection.error}
                    </p>
                    <details className="text-xs text-gray-600 dark:text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                        Ver contenido de la sección
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
                        {failedSection.content.substring(0, 500)}
                        {failedSection.content.length > 500 ? '...' : ''}
                      </pre>
                    </details>
                  </div>
                  <button
                    onClick={() => handleRetrySection(failedSection)}
                    disabled={loading}
                    className="h-10 px-4 rounded-lg bg-red-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    {loading ? 'Reanalizando...' : 'Reanalizar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {status && (
        <Card className={
          status.includes(t('importSuccess')?.slice(0, 10) || '') || status.includes('exitosamente')
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : status.includes('❌') || status.includes(t('uploadFailed')?.slice(0, 5) || '') || status.includes('Error') || status.includes('error')
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            : status.includes('Advertencia') || status.includes('Warning')
            ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
            : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/30'
        }>
          <div className="pb-24">
            <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{status}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function RecordRow({ record, index, isEditing, onEdit, onSave, onCancel, onRemove, expenseTypeMap, onExpenseTypeChange, t }) {
  const [editedRecord, setEditedRecord] = useState(record);

  React.useEffect(() => {
    if (isEditing) {
      setEditedRecord(record);
    }
  }, [isEditing, record]);

  const handleSave = () => {
    onSave(index, editedRecord);
  };

  const handleFieldChange = (field, value) => {
    setEditedRecord({ ...editedRecord, [field]: value });
  };

  if (isEditing) {
    return (
      <tr className="border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
        <td className="p-2">
          <CustomSelect
            value={editedRecord.kind}
            onChange={(v) => handleFieldChange('kind', v)}
            options={[
              { value: 'expense', label: t('expense') },
              { value: 'income', label: t('income') },
            ]}
            className="w-full"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editedRecord.categoria || ''}
            onChange={(e) => handleFieldChange('categoria', e.target.value)}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="text"
            value={editedRecord.nombre || ''}
            onChange={(e) => handleFieldChange('nombre', e.target.value)}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            step="0.01"
            value={editedRecord.amount || ''}
            onChange={(e) => handleFieldChange('amount', Number(e.target.value))}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          />
        </td>
        <td className="p-2">
          <input
            type="date"
            value={editedRecord.date ? new Date(editedRecord.date).toISOString().slice(0, 10) : ''}
            onChange={(e) => handleFieldChange('date', new Date(e.target.value).toISOString())}
            className="w-full px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </td>
        <td className="p-2">
          {editedRecord.kind === 'expense' ? (
            <CustomSelect
              value={(() => {
                const cat = (editedRecord.categoria || '').toLowerCase();
                const concept = (editedRecord.nombre || '').toLowerCase();
                const key = `${cat}::${concept}`;
                return expenseTypeMap?.[key] || 'MENSUAL';
              })()}
              onChange={(v) => {
                const cat = (editedRecord.categoria || '').toLowerCase();
                const concept = (editedRecord.nombre || '').toLowerCase();
                const key = `${cat}::${concept}`;
                if (onExpenseTypeChange) {
                  onExpenseTypeChange(key, v);
                }
              }}
              options={[
                { value: 'MENSUAL', label: 'Mensual' },
                { value: 'SEMESTRAL', label: 'Semestral' },
                { value: 'ANUAL', label: 'Anual' },
                { value: 'EXCEPCIONAL', label: 'Excepcional' },
              ]}
              className="w-full"
            />
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="p-2">
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              className="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600"
            >
              ✓
            </button>
            <button
              onClick={onCancel}
              className="px-2 py-1 rounded bg-gray-500 text-white text-xs hover:bg-gray-600"
            >
              ✕
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const getExpenseTypeLabel = (expenseType) => {
    const labels = {
      'MENSUAL': 'Mensual',
      'SEMESTRAL': 'Semestral',
      'ANUAL': 'Anual',
      'EXCEPCIONAL': 'Excepcional'
    };
    return labels[expenseType] || expenseType;
  };

  const getExpenseType = () => {
    if (record.kind !== 'expense') return null;
    const cat = (record.categoria || '').toLowerCase();
    const concept = (record.nombre || '').toLowerCase();
    const key = `${cat}::${concept}`;
    return expenseTypeMap?.[key] || null;
  };

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="p-2">{record.kind === 'income' ? t('income') : t('expense')}</td>
      <td className="p-2">{capitalizeWords(record.categoria || '-')}</td>
      <td className="p-2">{capitalizeWords(record.nombre || '-')}</td>
      <td className="p-2">
        {(record.currency || 'ARS') === 'ARS' 
          ? formatMoneyNoDecimals(record.amount, 'ARS', { sign: 'auto' })
          : formatMoney(record.amount, record.currency, { sign: 'auto' })
        }
      </td>
      <td className="p-2">{formatDate(record.date)}</td>
      <td className="p-2">
        {getExpenseType() ? getExpenseTypeLabel(getExpenseType()) : '-'}
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(index)}
            className="px-2 py-1 rounded bg-primary/10 text-primary dark:bg-primary/20 text-xs hover:bg-primary/20"
          >
            {t('editRecord')}
          </button>
          <button
            onClick={() => onRemove(index)}
            className="px-2 py-1 rounded bg-red-500/10 text-red-500 dark:bg-red-500/20 text-xs hover:bg-red-500/20"
          >
            {t('removeRecord')}
          </button>
        </div>
      </td>
    </tr>
  );
}
