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
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [operationAmountError, setOperationAmountError] = useState(null);
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

  // Get investment categories (Moneda, Equity, Crypto)
  const investmentCategories = useMemo(() => {
    const investmentTypes = ['moneda', 'equity', 'crypto'];
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

  async function ensureInvestmentCategories() {
    const investmentTypes = ['moneda', 'equity', 'crypto'];
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
    
    if (!formData.categoryId || !formData.concept || !formData.currentAmount || !formData.originalAmount || !formData.date) {
      setToast({
        message: 'Por favor completa todos los campos requeridos',
        type: 'warning',
      });
      return;
    }

    try {
      // Obtener el tipo de inversión para determinar si debemos obtener el precio automáticamente
      const selectedCategory = investmentCategories.find(cat => cat.id === formData.categoryId);
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

      const payload = {
        categoryId: formData.categoryId,
        concept: formData.concept.trim(),
        currentAmount: parseDecimal(formData.currentAmount),
        currentPrice: currentPrice,
        originalAmount: parseDecimal(formData.originalAmount),
        tag: formData.tag.trim() || undefined,
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

  function renderInvestmentGroup(typeName, investments) {
    if (investments.length === 0) return null;

    const typeLabel = {
      moneda: 'Moneda',
      equity: 'Equity',
      crypto: 'Crypto',
    }[typeName] || typeName;

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

    return (
      <Card key={typeName} title={typeLabel} className="mb-6">
        <div className="space-y-4">
          {/* Summary */}
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-sm font-semibold">Concepto</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold">Cantidad Actual</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold">Precio Actual</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold">Inversión Original</th>
                  <th className="text-right py-2 px-3 text-sm font-semibold">Ganancia/Pérdida</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Tag</th>
                  <th className="text-left py-2 px-3 text-sm font-semibold">Entidad de Custodia</th>
                  <th className="text-center py-2 px-3 text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {investments.map(inv => {
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
                        <td className="text-right py-2 px-3">{inv.currentPrice ? formatMoneyNoDecimals(inv.currentPrice, 'ARS', { sign: 'none' }) : '-'}</td>
                        <td className="text-right py-2 px-3">
                          {formatMoneyNoDecimals(costBasis, 'ARS', { sign: 'none' })}
                        </td>
                        <td className={`text-right py-2 px-3 ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatMoneyNoDecimals(gain, 'ARS')} ({gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%)
                        </td>
                        <td className="py-2 px-3">{inv.tag || '-'}</td>
                        <td className="py-2 px-3">{inv.custodyEntity || '-'}</td>
                      <td className="text-center py-2 px-3">
                        <button
                          onClick={() => handleAddOperation(inv)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                        >
                          Agregar Operación
                        </button>
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
          <p className="text-[#616f89] dark:text-gray-400">Gestiona tus inversiones en Moneda, Equity y Crypto</p>
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

      {showForm && (
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

            <div>
              <label className="block text-sm font-medium mb-1">Concepto *</label>
              <input
                type="text"
                value={formData.concept}
                onChange={(e) => handleFormChange('concept', e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: BTC, USD, AAPL"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cantidad Actual *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.currentAmount}
                onChange={(e) => handleFormChange('currentAmount', e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: 1,5"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Inversión Original *</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.originalAmount}
                onChange={(e) => handleFormChange('originalAmount', e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: 50000,25"
                required
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium mb-1">Entidad de Custodia</label>
              <input
                type="text"
                value={formData.custodyEntity}
                onChange={(e) => handleFormChange('custodyEntity', e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: Binance, IOL, etc."
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
      )}

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
                        // Para moneda, usar el precio actual si existe
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
          {renderInvestmentGroup('moneda', groupedInvestments.moneda)}
          {renderInvestmentGroup('equity', groupedInvestments.equity)}
          {renderInvestmentGroup('crypto', groupedInvestments.crypto)}
          
          {investments.length === 0 && (
            <Card>
              <p className="text-center text-gray-500">No hay inversiones registradas. Agrega tu primera inversión.</p>
            </Card>
          )}
        </>
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

