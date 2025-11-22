import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import Toast from '../components/Toast.jsx';
import { formatMoneyNoDecimals, capitalizeWords } from '../utils/format.js';
import * as api from '../api/index.js';

export default function Investment() {
  const { categories } = useApp();
  const location = useLocation();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(null);
  const [operations, setOperations] = useState([]);
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [showSymbolSuggestions, setShowSymbolSuggestions] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [operationAmountError, setOperationAmountError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [investmentToDelete, setInvestmentToDelete] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    concept: '',
    currentAmount: '',
    currentPrice: '',
    tag: '',
    originalAmount: '',
    custodyEntity: '',
    date: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
  });
  const [operationData, setOperationData] = useState({
    type: 'COMPRA',
    amount: '',
    price: '',
    note: '',
    date: new Date().toISOString().split('T')[0], // Fecha actual en formato YYYY-MM-DD
  });

  // Get investment categories (Dolar, Equity, Crypto)
  const investmentCategories = useMemo(() => {
    const investmentTypes = ['dolar', 'equity', 'crypto'];
    const filtered = categories.filter(cat => 
      cat.type && investmentTypes.includes(cat.type.name.toLowerCase())
    );
    
    // If categories don't exist, return empty array (they will be created on first use)
    if (filtered.length === 0 && categories.length > 0) {
      // Categories might not be loaded yet, return empty
      return [];
    }
    
    return filtered;
  }, [categories]);

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

  async function updatePricesSilently() {
    try {
      // Primero actualizar los precios desde las APIs
      await api.updatePrices();
      // Luego actualizar los precios de las inversiones
      await api.updateInvestmentPrices();
      // Recargar las inversiones para ver los precios actualizados
      await loadInvestments();
    } catch (error) {
      console.error('Error updating prices silently:', error);
      // No mostrar error al usuario, solo loguear
    }
  }

  useEffect(() => {
    ensureInvestmentCategories();
    // Cargar inversiones y actualizar precios automáticamente al cargar la página
    loadInvestments().then(() => {
      updatePricesSilently();
    });
  }, []);

  // Efecto separado para manejar la apertura de formularios desde el Dashboard
  useEffect(() => {
    if (location.state?.openForm === 'investment') {
      setShowForm(true);
      // Limpiar el estado para evitar que se abra cada vez que se renderiza
      window.history.replaceState({}, document.title);
    } else if (location.state?.openForm === 'operation') {
      setSelectedInvestmentId(null);
      setOperationData({
        type: 'COMPRA',
        amount: '',
        price: '',
        note: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowOperationForm(true);
      // Limpiar el estado para evitar que se abra cada vez que se renderiza
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (investments.length > 0) {
      // Cargar operaciones para todas las inversiones
      investments.forEach(inv => {
        loadOperations(inv.id);
      });
    }
  }, [investments.length]);

  useEffect(() => {
    if (showForm && formData.categoryId) {
      const selectedCategory = investmentCategories.find(cat => cat.id === formData.categoryId);
      console.log('Selected category:', selectedCategory);
      if (selectedCategory) {
        const typeName = selectedCategory.type.name.toLowerCase();
        console.log('Category type name:', typeName);
        if (typeName === 'crypto' || typeName === 'equity') {
          console.log(`Loading symbols for ${typeName}`);
          loadAvailableSymbols(typeName);
        } else {
          console.log(`Type ${typeName} does not need symbols, clearing`);
          setAvailableSymbols([]);
          setFilteredSymbols([]);
        }
      } else {
        console.log('No category found for categoryId:', formData.categoryId);
      }
    } else {
      console.log('Form not shown or no categoryId. showForm:', showForm, 'categoryId:', formData.categoryId);
    }
  }, [showForm, formData.categoryId, investmentCategories]);

  async function ensureInvestmentCategories() {
    const investmentTypes = ['dolar', 'equity', 'crypto'];
    for (const typeName of investmentTypes) {
      // Check if category exists with this type
      const existingCategory = categories.find(c => 
        c.type && c.type.name.toLowerCase() === typeName && c.name.toLowerCase() === typeName
      );
      if (!existingCategory) {
        // Create the category with the type (the type will be created automatically if it doesn't exist)
        try {
          await api.createCategory({ name: typeName, typeName });
          // Reload categories after creating
          await api.getCategories();
          // Update context if possible, or just reload page data
        } catch (err) {
          console.error(`Error creating category ${typeName}:`, err);
        }
      }
    }
  }

  async function loadInvestments() {
    setLoading(true);
    try {
      const data = await api.getInvestments();
      // Filtrar inversiones con cantidad 0
      const filteredData = (data || []).filter(inv => inv.currentAmount > 0);
      setInvestments(filteredData);
    } catch (error) {
      console.error('Error loading investments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOperations(investmentId) {
    try {
      const data = await api.getInvestmentOperations(investmentId);
      setOperations(data || []);
    } catch (error) {
      console.error('Error loading operations:', error);
    }
  }

  async function loadAvailableSymbols(type, query = '') {
    try {
      console.log(`Loading available symbols for type: ${type}, query: ${query}`);
      const symbols = await api.getAvailableSymbols(type, query);
      console.log(`API returned symbols:`, symbols);
      const symbolsArray = Array.isArray(symbols) ? symbols : [];
      console.log(`Setting ${symbolsArray.length} symbols for type ${type}:`, symbolsArray);
      
      if (query) {
        // Si hay query, estos son resultados de búsqueda, actualizar filteredSymbols
        setFilteredSymbols(symbolsArray);
        setShowSymbolSuggestions(symbolsArray.length > 0);
      } else {
        // Si no hay query, actualizar availableSymbols (símbolos de la base de datos)
        setAvailableSymbols(symbolsArray);
        setFilteredSymbols(symbolsArray);
      }
    } catch (error) {
      console.error('Error loading available symbols:', error);
      console.error('Error details:', error.response?.data || error.message);
      if (!query) {
        setAvailableSymbols([]);
        setFilteredSymbols([]);
      }
    }
  }

  // Helper para convertir coma a punto para parseFloat
  function parseDecimal(value) {
    if (!value) return 0;
    const normalized = String(value).replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  // Helper para formatear número con coma como decimal
  function formatDecimal(value) {
    if (!value && value !== 0) return '';
    return String(value).replace('.', ',');
  }

  function handleFormChange(field, value) {
    // Para categoryId, concept, tag, custodyEntity y date, usar el valor directamente sin limpiar
    if (field === 'categoryId' || field === 'concept' || field === 'tag' || field === 'custodyEntity' || field === 'date') {
      setFormData(prev => ({ ...prev, [field]: value }));
      
      // Si cambia el tipo de inversión, cargar símbolos disponibles
      if (field === 'categoryId') {
        const selectedCategory = investmentCategories.find(cat => cat.id === value);
        if (selectedCategory) {
          const typeName = selectedCategory.type.name.toLowerCase();
          if (typeName === 'crypto' || typeName === 'equity') {
            loadAvailableSymbols(typeName);
          } else {
            setAvailableSymbols([]);
          }
        }
      }
      
      // Si cambia el concepto, buscar en la API con debounce
      if (field === 'concept') {
        const selectedCategory = investmentCategories.find(cat => cat.id === formData.categoryId);
        const typeName = selectedCategory?.type?.name?.toLowerCase();
        
        // Limpiar timeout anterior
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        if (value.length > 0 && (typeName === 'crypto' || typeName === 'equity')) {
          // Mostrar sugerencias inmediatamente si hay texto
          setShowSymbolSuggestions(true);
          
          // Buscar en la API con debounce (esperar 300ms después de que el usuario deje de escribir)
          const timeout = setTimeout(() => {
            loadAvailableSymbols(typeName, value);
          }, 300);
          setSearchTimeout(timeout);
        } else if (value.length === 0) {
          // Si no hay texto, ocultar sugerencias
          setShowSymbolSuggestions(false);
          setFilteredSymbols([]);
        }
      }
      
      return;
    }
    // Para otros campos numéricos, permitir solo números, comas y puntos
    const cleaned = value.replace(/[^0-9,.-]/g, '');
    // Reemplazar punto por coma si se escribe punto
    const normalized = cleaned.replace('.', ',');
    setFormData(prev => ({ ...prev, [field]: normalized }));
  }

  function resetForm() {
    setFormData({
      categoryId: '',
      concept: '',
      currentAmount: '',
      currentPrice: '',
      tag: '',
      originalAmount: '',
      custodyEntity: '',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const selectedCategory = investmentCategories.find(cat => cat.id === formData.categoryId);
    const isDolar = selectedCategory?.type?.name?.toLowerCase() === 'dolar';
    
    // Validación diferente para dólares
    if (isDolar) {
      if (!formData.categoryId || !formData.currentAmount || !formData.date || !formData.custodyEntity) {
        setToast({
          message: 'Por favor completa todos los campos requeridos',
          type: 'warning',
        });
        return;
      }
    } else {
      if (!formData.categoryId || !formData.concept || !formData.currentAmount || !formData.originalAmount || !formData.date) {
        setToast({
          message: 'Por favor completa todos los campos requeridos',
          type: 'warning',
        });
        return;
      }
    }

    try {
      // Obtener el tipo de inversión para determinar si debemos obtener el precio automáticamente
      const typeName = selectedCategory?.type?.name?.toLowerCase();
      let currentPrice = formData.currentPrice ? parseDecimal(formData.currentPrice) : undefined;

      // Si no hay precio y es crypto o equity, intentar obtenerlo desde la API
      if (!currentPrice && (typeName === 'crypto' || typeName === 'equity')) {
        try {
          const price = await api.getPrice(formData.concept.trim().toUpperCase());
          if (price && price > 0) {
            currentPrice = price;
          }
        } catch (error) {
          console.error('Error getting price from API:', error);
          // Continuar sin precio si falla
        }
      }

      // Para dólares, establecer valores por defecto
      const payload = {
        categoryId: formData.categoryId,
        concept: isDolar ? 'USD' : formData.concept.trim(),
        currentAmount: parseDecimal(formData.currentAmount),
        currentPrice: currentPrice,
        originalAmount: isDolar ? parseDecimal(formData.currentAmount) : parseDecimal(formData.originalAmount),
        tag: isDolar ? undefined : (formData.tag.trim() || undefined),
        custodyEntity: formData.custodyEntity.trim() || undefined,
        date: formData.date,
      };

      if (editingId) {
        await api.updateInvestment(editingId, payload);
      } else {
        await api.createInvestment(payload);
      }

      // Actualizar precios automáticamente después de crear/actualizar
      await updatePricesSilently();
      resetForm();
      setToast({
        message: editingId ? 'Inversión actualizada exitosamente' : 'Inversión creada exitosamente',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving investment:', error);
      setToast({
        message: 'Error al guardar la inversión',
        type: 'error',
      });
    }
  }


  async function handleAddOperation(inv) {
    setSelectedInvestmentId(inv.id);
    setOperationData({
      type: 'COMPRA',
      amount: '',
      price: inv.currentPrice ? formatDecimal(inv.currentPrice) : '',
      note: '',
    });
    setOperationAmountError(null);
    setShowOperationForm(true);
    await loadOperations(inv.id);
  }

  function handleOperationAmountChange(value) {
    // Permitir solo números, comas y puntos
    const cleaned = value.replace(/[^0-9,.-]/g, '');
    // Reemplazar punto por coma si se escribe punto
    const normalized = cleaned.replace('.', ',');
    
    setOperationData(prev => {
      const newData = { ...prev, amount: normalized };
      
      // Validar en tiempo real si es una venta
      if (prev.type === 'VENTA' && normalized) {
        const selectedInv = investments.find(inv => inv.id === selectedInvestmentId);
        if (selectedInv) {
          const amountToSell = parseDecimal(normalized);
          if (!isNaN(amountToSell) && amountToSell > selectedInv.currentAmount) {
            setOperationAmountError(`No puedes vender más de ${selectedInv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
          } else {
            setOperationAmountError(null);
          }
        }
      } else {
        setOperationAmountError(null);
      }
      
      return newData;
    });
  }


  async function handleOperationSubmit(e) {
    e.preventDefault();
    if (!selectedInvestmentId) {
      setToast({
        message: 'Por favor selecciona una inversión',
        type: 'warning',
      });
      return;
    }

    // Validar que no se venda más de lo que hay
    if (operationData.type === 'VENTA') {
      const selectedInv = investments.find(inv => inv.id === selectedInvestmentId);
      if (selectedInv) {
        const amountToSell = parseDecimal(operationData.amount);
        if (amountToSell > selectedInv.currentAmount) {
          setToast({
            message: `No puedes vender más de lo que tienes. Cantidad disponible: ${selectedInv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
            type: 'error',
          });
          return;
        }
      }
    }

    try {
      await api.createInvestmentOperation({
        investmentId: selectedInvestmentId,
        type: operationData.type,
        amount: parseDecimal(operationData.amount),
        price: operationData.price ? parseDecimal(operationData.price) : undefined,
        note: operationData.note || undefined,
        date: operationData.date,
      });
      await loadInvestments();
      await loadOperations(selectedInvestmentId);
      // Actualizar precios automáticamente después de crear una operación
      await updatePricesSilently();
      setShowOperationForm(false);
      setSelectedInvestmentId(null);
      setOperationData({
        type: 'COMPRA',
        amount: '',
        price: '',
        note: '',
        date: new Date().toISOString().split('T')[0],
      });
      setToast({
        message: 'Operación creada exitosamente',
        type: 'success',
      });
    } catch (error) {
      console.error('Error creating operation:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al crear la operación';
      setToast({
        message: errorMessage,
        type: 'error',
      });
    }
  }

  function handleEdit(inv) {
    setEditingId(inv.id);
    setFormData({
      categoryId: inv.categoryId,
      concept: inv.concept || '',
      currentAmount: formatDecimal(inv.currentAmount),
      currentPrice: inv.currentPrice ? formatDecimal(inv.currentPrice) : '',
      tag: inv.tag || '',
      originalAmount: formatDecimal(inv.originalAmount),
      custodyEntity: inv.custodyEntity || '',
      date: inv.date ? new Date(inv.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setShowForm(true);
  }

  function handleDeleteClick(inv) {
    setInvestmentToDelete(inv);
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    if (!investmentToDelete) return;
    
    try {
      await api.deleteInvestment(investmentToDelete.id);
      setToast({
        message: 'Inversión eliminada exitosamente',
        type: 'success',
      });
      loadInvestments();
      setShowDeleteModal(false);
      setInvestmentToDelete(null);
    } catch (error) {
      console.error('Error deleting investment:', error);
      setToast({
        message: 'Error al eliminar la inversión',
        type: 'error',
      });
    }
  }

  function cancelDelete() {
    setShowDeleteModal(false);
    setInvestmentToDelete(null);
  }

  function renderInvestmentGroup(typeName, investments) {
    if (investments.length === 0) return null;

    const typeLabel = {
      dolar: 'Dólar',
      equity: 'Equity',
      crypto: 'Crypto',
    }[typeName] || typeName;

    // Ordenar por valor de mercado descendente para crypto y equity, por cantidad descendente para dólar
    const sortedInvestments = [...investments];
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

    const totalCurrent = investments.reduce((sum, inv) => {
      const currentValue = (inv.currentAmount || 0) * (inv.currentPrice || 0);
      return sum + currentValue;
    }, 0);
    const totalCostBasis = investments.reduce((sum, inv) => {
      // Calcular costo total: inversión original + suma de precios de operaciones de compra
      const invOperations = operations.filter(op => op.investmentId === inv.id);
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
      const invOperations = operations.filter(op => op.investmentId === inv.id);
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-semibold">Concepto</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold">Cantidad Actual</th>
                  {typeName !== 'dolar' && (
                    <th className="text-right py-2 px-3 text-sm font-semibold">Precio Actual</th>
                  )}
                  {(typeName === 'crypto' || typeName === 'equity') && (
                    <th className="text-right py-2 px-3 text-sm font-semibold">Valor de Mercado</th>
                  )}
                  {typeName !== 'dolar' && (
                    <th className="text-right py-2 px-3 text-sm font-semibold">Inversión Original</th>
                  )}
                  {typeName !== 'dolar' && (
                    <th className="text-right py-2 px-3 text-sm font-semibold">Ganancia/Pérdida</th>
                  )}
                  {typeName !== 'dolar' && (
                    <th className="text-left py-2 px-3 text-sm font-semibold">Tag</th>
                  )}
                  <th className="text-left py-2 px-3 text-sm font-semibold">Entidad de Custodia</th>
                  <th className="text-center py-2 px-3 text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvestments.map(inv => {
                  const currentValue = (inv.currentAmount || 0) * (inv.currentPrice || 0);
                  // Calcular costo total: inversión original + suma de precios de operaciones de compra
                  const invOperations = operations.filter(op => op.investmentId === inv.id);
                  const purchaseCost = invOperations
                    .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
                    .reduce((total, op) => total + (op.price * op.amount), 0);
                  const costBasis = (inv.originalAmount || 0) + purchaseCost;
                  const gain = currentValue - costBasis;
                  const gainPercent = costBasis > 0 ? ((gain / costBasis) * 100) : 0;
                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-3">{inv.concept}</td>
                        <td className="text-right py-2 px-3">{inv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                        {typeName !== 'dolar' && (
                          <td className="text-right py-2 px-3">{inv.currentPrice ? formatMoneyNoDecimals(inv.currentPrice, 'ARS', { sign: 'none' }) : '-'}</td>
                        )}
                        {(typeName === 'crypto' || typeName === 'equity') && (
                          <td className="text-right py-2 px-3 font-semibold">
                            {formatMoneyNoDecimals(currentValue, 'ARS', { sign: 'none' })}
                          </td>
                        )}
                        {typeName !== 'dolar' && (
                          <td className="text-right py-2 px-3">
                            {formatMoneyNoDecimals(costBasis, 'ARS', { sign: 'none' })}
                          </td>
                        )}
                        {typeName !== 'dolar' && (
                          <td className={`text-right py-2 px-3 ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatMoneyNoDecimals(gain, 'ARS')} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                          </td>
                        )}
                        {typeName !== 'dolar' && (
                          <td className="py-2 px-3">{inv.tag || '-'}</td>
                        )}
                        <td className="py-2 px-3">{inv.custodyEntity || '-'}</td>
                        <td className="text-center py-2 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(inv)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                              title="Editar"
                            >
                              Editar
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <button
                              onClick={() => handleDeleteClick(inv)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                              title="Eliminar"
                            >
                              Eliminar
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <button
                              onClick={() => handleAddOperation(inv)}
                              className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-sm"
                              title="Agregar Operación"
                            >
                              Operación
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">Inversiones</p>
          <p className="text-[#616f89] dark:text-gray-400">Gestiona tus inversiones en Dólar, Equity y Crypto</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedInvestmentId(null);
              setOperationData({
                type: 'COMPRA',
                amount: '',
                price: '',
                note: '',
              });
              setShowOperationForm(true);
            }}
            className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Agregar Operación
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="h-9 px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
          >
            Agregar Inversión
          </button>
        </div>
      </header>

      {showForm && (() => {
        const selectedCategory = investmentCategories.find(cat => cat.id === formData.categoryId);
        const isDolar = selectedCategory?.type?.name?.toLowerCase() === 'dolar';
        
        return (
          <Card title={editingId ? 'Editar Inversión' : 'Nueva Inversión'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Inversión *</label>
                <CustomSelect
                  value={formData.categoryId || ''}
                  onChange={(v) => handleFormChange('categoryId', v)}
                  options={[
                    { value: '', label: 'Selecciona un tipo' },
                    ...investmentCategories.map(cat => ({
                      value: cat.id,
                      label: capitalizeWords(cat.type.name)
                    }))
                  ]}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {!isDolar && (
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">Concepto *</label>
                  <input
                    type="text"
                    value={formData.concept}
                    onChange={(e) => handleFormChange('concept', e.target.value)}
                    onFocus={() => {
                      // Mostrar sugerencias si hay texto o si hay símbolos disponibles
                      if (formData.concept && formData.concept.length > 0) {
                        if (filteredSymbols.length > 0) {
                          setShowSymbolSuggestions(true);
                        } else if (availableSymbols.length > 0) {
                          // Si no hay filtrados pero hay símbolos disponibles, mostrar todos
                          setFilteredSymbols(availableSymbols);
                          setShowSymbolSuggestions(true);
                        }
                      } else if (availableSymbols.length > 0) {
                        // Si no hay texto pero hay símbolos, mostrar todos
                        setFilteredSymbols(availableSymbols);
                        setShowSymbolSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay para permitir click en sugerencias
                      setTimeout(() => setShowSymbolSuggestions(false), 200);
                    }}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: BTC, USD, AAPL"
                    required={!isDolar}
                  />
                  {showSymbolSuggestions && filteredSymbols.length > 0 && (
                    <div 
                      className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                      onMouseDown={(e) => {
                        // Prevenir que el blur del input oculte el menú
                        e.preventDefault();
                      }}
                    >
                      {filteredSymbols.slice(0, 10).map((symbol) => (
                        <div
                          key={symbol}
                          className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleFormChange('concept', symbol);
                            setShowSymbolSuggestions(false);
                          }}
                        >
                          {symbol}
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.concept && formData.concept.length > 0 && availableSymbols.length === 0 && !showSymbolSuggestions && (
                    <div className="absolute z-50 w-full mt-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                      <p>No hay símbolos disponibles. Los símbolos aparecerán cuando:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Crear inversiones de tipo {selectedCategory?.type?.name || 'Crypto/Equity'}</li>
                        <li>Actualizar precios desde la API</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!isDolar && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cantidad Actual *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.currentAmount}
                    onChange={(e) => handleFormChange('currentAmount', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 1,5"
                    required={!isDolar}
                  />
                </div>
              )}

              {isDolar && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cantidad *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.currentAmount}
                    onChange={(e) => handleFormChange('currentAmount', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 1000"
                    required
                  />
                </div>
              )}

              {!isDolar && (
                <div>
                  <label className="block text-sm font-medium mb-1">Inversión Original *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.originalAmount}
                    onChange={(e) => handleFormChange('originalAmount', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: 50000,25"
                    required={!isDolar}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Fecha *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              {!isDolar && (
                <div>
                  <label className="block text-sm font-medium mb-1">Tag</label>
                  <input
                    type="text"
                    value={formData.tag}
                    onChange={(e) => handleFormChange('tag', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Opcional"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Entidad de Custodia{isDolar ? ' *' : ''}</label>
                <input
                  type="text"
                  value={formData.custodyEntity}
                  onChange={(e) => handleFormChange('custodyEntity', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ej: Binance, IOL, etc."
                  required={isDolar}
                />
              </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
              >
                {editingId ? 'Actualizar' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
        );
      })()}

      {showOperationForm && (
        <Card title="Agregar Operación">
          <form onSubmit={handleOperationSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Inversión *</label>
              <CustomSelect
                value={selectedInvestmentId || ''}
                onChange={async (v) => {
                  setSelectedInvestmentId(v);
                  const selectedInv = investments.find(inv => inv.id === v);
                  setOperationAmountError(null);
                  
                  if (v) {
                    loadOperations(v);
                    
                    // Obtener precio actual desde la API automáticamente
                    if (selectedInv) {
                      const typeName = selectedInv.category?.type?.name?.toLowerCase();
                      // Solo obtener precio automáticamente para crypto y equity
                      if (typeName === 'crypto' || typeName === 'equity') {
                        try {
                          const price = await api.getPrice(selectedInv.concept.toUpperCase());
                          if (price && price > 0) {
                            setOperationData(prev => ({ 
                              ...prev, 
                              price: formatDecimal(price)
                            }));
                          } else if (selectedInv.currentPrice) {
                            // Si no hay precio en la API, usar el precio actual de la inversión
                            setOperationData(prev => ({ 
                              ...prev, 
                              price: formatDecimal(selectedInv.currentPrice)
                            }));
                          }
                        } catch (error) {
                          console.error('Error getting price from API:', error);
                          // Si falla, usar el precio actual de la inversión si existe
                          if (selectedInv.currentPrice) {
                            setOperationData(prev => ({ 
                              ...prev, 
                              price: formatDecimal(selectedInv.currentPrice)
                            }));
                          }
                        }
                      } else if (selectedInv.currentPrice) {
                        // Para dólar, usar el precio actual si existe
                        setOperationData(prev => ({ 
                          ...prev, 
                          price: formatDecimal(selectedInv.currentPrice)
                        }));
                      }
                    }
                  }
                }}
                options={[
                  { value: '', label: 'Selecciona una inversión' },
                  ...investments.map(inv => ({
                    value: inv.id,
                    label: `${inv.concept} - ${inv.category?.type?.name ? capitalizeWords(inv.category.type.name) : ''}`
                  }))
                ]}
                className="w-full"
                buttonClassName="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Operación *</label>
              <CustomSelect
                value={operationData.type}
                onChange={(v) => {
                  setOperationData(prev => ({ ...prev, type: v }));
                  setOperationAmountError(null);
                }}
                options={[
                  { value: 'COMPRA', label: 'Compra' },
                  { value: 'VENTA', label: 'Venta' },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cantidad *</label>
              <input
                type="text"
                inputMode="decimal"
                value={operationData.amount}
                onChange={(e) => handleOperationAmountChange(e.target.value)}
                className={`w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border ${
                  operationAmountError 
                    ? 'border-red-500 dark:border-red-500' 
                    : 'border-gray-300 dark:border-gray-700'
                } focus:outline-none focus:ring-2 focus:ring-primary`}
                placeholder={operationData.type === 'VENTA' ? 'Cantidad a vender (ej: 1,5)' : 'Cantidad a comprar (ej: 1,5)'}
                required
              />
              {operationAmountError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{operationAmountError}</p>
              )}
              {operationData.type === 'VENTA' && selectedInvestmentId && (() => {
                const selectedInv = investments.find(inv => inv.id === selectedInvestmentId);
                if (selectedInv) {
                  return (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Disponible: {selectedInv.currentAmount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Precio por Unidad</label>
              <input
                type="text"
                inputMode="decimal"
                value={operationData.price}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9,.-]/g, '');
                  const normalized = cleaned.replace('.', ',');
                  setOperationData(prev => ({ ...prev, price: normalized }));
                }}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: 1000,50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fecha *</label>
              <input
                type="date"
                value={operationData.date}
                onChange={(e) => setOperationData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nota</label>
              <textarea
                value={operationData.note}
                onChange={(e) => setOperationData(prev => ({ ...prev, note: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Opcional"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOperationForm(false);
                  setSelectedInvestmentId(null);
                  setOperationData({ type: 'COMPRA', amount: '', price: '', note: '', date: new Date().toISOString().split('T')[0] });
                }}
                className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-gray-500">Cargando...</p>
      ) : (
        <>
          {renderInvestmentGroup('dolar', groupedInvestments.dolar)}
          {renderInvestmentGroup('equity', groupedInvestments.equity)}
          {renderInvestmentGroup('crypto', groupedInvestments.crypto)}
          
          {investments.length === 0 && (
            <Card>
              <p className="text-center text-gray-500">No hay inversiones registradas. Agrega tu primera inversión.</p>
            </Card>
          )}
        </>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && investmentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={cancelDelete}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Confirmar Eliminación
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que deseas eliminar la inversión <span className="font-semibold text-gray-900 dark:text-gray-100">"{investmentToDelete.concept}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelDelete}
                  className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

