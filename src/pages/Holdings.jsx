import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import Card from '../components/Card.jsx';
import CustomSelect from '../components/CustomSelect.jsx';
import Toast from '../components/Toast.jsx';
import { capitalizeWords } from '../utils/format.js';
import * as api from '../api/index.js';

export default function Holdings() {
  const { categories } = useApp();
  const [persons, setPersons] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [selectedHoldingId, setSelectedHoldingId] = useState(null);
  const [operations, setOperations] = useState([]);
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [showSymbolSuggestions, setShowSymbolSuggestions] = useState(false);
  const [filteredSymbols, setFilteredSymbols] = useState([]);
  const [editingPersonId, setEditingPersonId] = useState(null);
  const [editingHoldingId, setEditingHoldingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [operationAmountError, setOperationAmountError] = useState(null);
  const [showDeletePersonModal, setShowDeletePersonModal] = useState(false);
  const [showDeleteHoldingModal, setShowDeleteHoldingModal] = useState(false);
  const [personToDelete, setPersonToDelete] = useState(null);
  const [holdingToDelete, setHoldingToDelete] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [expandedConcepts, setExpandedConcepts] = useState(new Set()); // Set of concept keys that are expanded
  const [personFormData, setPersonFormData] = useState({
    name: '',
  });
  const [holdingFormData, setHoldingFormData] = useState({
    categoryId: '',
    concept: '',
    currentAmount: '',
    currentPrice: '',
    tag: '',
    sector: '',
    originalAmount: '',
    custodyEntity: '',
    date: new Date().toISOString().split('T')[0],
    x100: false,
    gbp: false,
  });
  const [gbpPrice, setGbpPrice] = useState(null);
  const [operationData, setOperationData] = useState({
    type: 'COMPRA',
    amount: '',
    price: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Get investment categories (Dolar, Equity, Crypto)
  const investmentCategories = useMemo(() => {
    const investmentTypes = ['dolar', 'equity', 'crypto'];
    return categories.filter(cat => 
      cat.type && investmentTypes.includes(cat.type.name.toLowerCase())
    );
  }, [categories]);

  // Group holdings by category type
  const groupedHoldings = useMemo(() => {
    const groups = {
      dolar: [],
      equity: [],
      crypto: [],
    };
    
    holdings.forEach(holding => {
      const typeName = holding.category?.type?.name?.toLowerCase() || '';
      if (typeName === 'dolar') groups.dolar.push(holding);
      else if (typeName === 'equity') groups.equity.push(holding);
      else if (typeName === 'crypto') groups.crypto.push(holding);
    });
    
    return groups;
  }, [holdings]);

  // Helper functions
  function parseDecimal(value) {
    if (!value) return 0;
    const normalized = String(value).replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  function formatDecimal(value) {
    if (!value && value !== 0) return '';
    return String(value).replace('.', ',');
  }

  function formatNumberWithConditionalDecimals(value) {
    const num = Number(value || 0);
    if (num < 100) {
      return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatMoneyWithConditionalDecimals(amount, currency = 'ARS', { sign = 'auto' } = {}) {
    const num = Number(amount || 0);
    const locale = currency === 'ARS' ? 'es-AR' : undefined;
    const minDecimals = num < 100 ? 2 : 0;
    const maxDecimals = num < 100 ? 2 : 0;
    
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
    const formatted = formatter.format(Math.abs(num));
    if (sign === 'none') return formatted;
    if (sign === 'always') return (num < 0 ? '-' : '+') + formatted;
    return (num < 0 ? '-' : '') + formatted;
  }

  useEffect(() => {
    loadPersons();
    loadGbpPrice();
  }, []);

  useEffect(() => {
    if (selectedPersonId) {
      loadHoldings(selectedPersonId);
    } else {
      setHoldings([]);
    }
  }, [selectedPersonId]);

  useEffect(() => {
    if (holdings.length > 0) {
      holdings.forEach(holding => {
        loadOperations(holding.id);
      });
    }
  }, [holdings.length]);

  async function loadPersons() {
    setLoading(true);
    try {
      const data = await api.getPersons();
      setPersons(data || []);
    } catch (error) {
      console.error('Error loading persons:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHoldings(personId) {
    setLoading(true);
    try {
      const data = await api.getHoldings(personId);
      const filteredData = (data || []).filter(h => h.currentAmount > 0);
      setHoldings(filteredData);
    } catch (error) {
      console.error('Error loading holdings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOperations(holdingId) {
    try {
      const data = await api.getHoldingOperations(holdingId);
      setOperations(prev => ({ ...prev, [holdingId]: data || [] }));
    } catch (error) {
      console.error('Error loading operations:', error);
    }
  }

  async function loadGbpPrice() {
    try {
      let price = await api.getPrice('GBPUSD=X');
      if (!price || price <= 0) {
        price = await api.getPrice('GBPUSD');
      }
      if (!price || price <= 0) {
        price = await api.getPrice('GBP=X');
      }
      if (price && price > 0) {
        setGbpPrice(price);
      } else {
        setGbpPrice(null);
      }
    } catch (error) {
      console.error('Error loading GBP price:', error);
      setGbpPrice(null);
    }
  }

  async function loadAvailableSymbols(type, query = '') {
    try {
      const symbols = await api.getAvailableSymbols(type, query);
      const symbolsArray = Array.isArray(symbols) ? symbols : [];
      
      if (query) {
        setFilteredSymbols(symbolsArray);
        setShowSymbolSuggestions(symbolsArray.length > 0);
      } else {
        setAvailableSymbols(symbolsArray);
        setFilteredSymbols(symbolsArray);
      }
    } catch (error) {
      console.error('Error loading available symbols:', error);
      if (!query) {
        setAvailableSymbols([]);
        setFilteredSymbols([]);
      }
    }
  }

  // Person handlers
  function handlePersonFormChange(field, value) {
    setPersonFormData(prev => ({ ...prev, [field]: value }));
  }

  function resetPersonForm() {
    setPersonFormData({ name: '' });
    setEditingPersonId(null);
    setShowPersonForm(false);
  }

  async function handlePersonSubmit(e) {
    e.preventDefault();
    if (!personFormData.name.trim()) {
      setToast({
        message: 'Por favor ingresa un nombre',
        type: 'warning',
      });
      return;
    }

    try {
      if (editingPersonId) {
        await api.updatePerson(editingPersonId, personFormData);
      } else {
        await api.createPerson(personFormData);
      }
      resetPersonForm();
      await loadPersons();
      setToast({
        message: editingPersonId ? 'Persona actualizada exitosamente' : 'Persona creada exitosamente',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving person:', error);
      setToast({
        message: 'Error al guardar la persona',
        type: 'error',
      });
    }
  }

  function handleEditPerson(person) {
    setEditingPersonId(person.id);
    setPersonFormData({ name: person.name });
    setShowPersonForm(true);
  }

  function handleDeletePersonClick(person) {
    setPersonToDelete(person);
    setShowDeletePersonModal(true);
  }

  async function confirmDeletePerson() {
    if (!personToDelete) return;
    
    try {
      await api.deletePerson(personToDelete.id);
      setToast({
        message: 'Persona eliminada exitosamente',
        type: 'success',
      });
      if (selectedPersonId === personToDelete.id) {
        setSelectedPersonId(null);
      }
      await loadPersons();
      setShowDeletePersonModal(false);
      setPersonToDelete(null);
    } catch (error) {
      console.error('Error deleting person:', error);
      setToast({
        message: 'Error al eliminar la persona',
        type: 'error',
      });
    }
  }

  // Holding handlers (similar to Investment handlers)
  function handleHoldingFormChange(field, value) {
    if (field === 'x100' || field === 'gbp') {
      setHoldingFormData(prev => ({ ...prev, [field]: value }));
      return;
    }
    if (field === 'categoryId' || field === 'concept' || field === 'tag' || field === 'sector' || field === 'custodyEntity' || field === 'date') {
      setHoldingFormData(prev => ({ ...prev, [field]: value }));
      
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
      
      if (field === 'concept') {
        const selectedCategory = investmentCategories.find(cat => cat.id === holdingFormData.categoryId);
        const typeName = selectedCategory?.type?.name?.toLowerCase();
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        if (value.length > 0 && (typeName === 'crypto' || typeName === 'equity')) {
          setShowSymbolSuggestions(true);
          const timeout = setTimeout(() => {
            loadAvailableSymbols(typeName, value);
          }, 300);
          setSearchTimeout(timeout);
        } else if (value.length === 0) {
          setShowSymbolSuggestions(false);
          setFilteredSymbols([]);
        }
      }
      
      return;
    }
    const cleaned = value.replace(/[^0-9,.-]/g, '');
    const normalized = cleaned.replace('.', ',');
    setHoldingFormData(prev => ({ ...prev, [field]: normalized }));
  }

  function resetHoldingForm() {
    setHoldingFormData({
      categoryId: '',
      concept: '',
      currentAmount: '',
      currentPrice: '',
      tag: '',
      sector: '',
      originalAmount: '',
      custodyEntity: '',
      date: new Date().toISOString().split('T')[0],
      x100: false,
      gbp: false,
    });
    setEditingHoldingId(null);
    setShowHoldingForm(false);
  }

  async function handleHoldingSubmit(e) {
    e.preventDefault();
    
    if (!selectedPersonId) {
      setToast({
        message: 'Por favor selecciona una persona',
        type: 'warning',
      });
      return;
    }

    const selectedCategory = investmentCategories.find(cat => cat.id === holdingFormData.categoryId);
    const isDolar = selectedCategory?.type?.name?.toLowerCase() === 'dolar';
    
    if (isDolar) {
      if (!holdingFormData.categoryId || !holdingFormData.currentAmount || !holdingFormData.date || !holdingFormData.custodyEntity) {
        setToast({
          message: 'Por favor completa todos los campos requeridos',
          type: 'warning',
        });
        return;
      }
    } else {
      if (!holdingFormData.categoryId || !holdingFormData.concept || !holdingFormData.currentAmount || !holdingFormData.originalAmount || !holdingFormData.date) {
        setToast({
          message: 'Por favor completa todos los campos requeridos',
          type: 'warning',
        });
        return;
      }
    }

    try {
      const typeName = selectedCategory?.type?.name?.toLowerCase();
      let currentPrice = holdingFormData.currentPrice ? parseDecimal(holdingFormData.currentPrice) : undefined;

      if (!currentPrice && (typeName === 'crypto' || typeName === 'equity')) {
        try {
          const price = await api.getPrice(holdingFormData.concept.trim().toUpperCase());
          if (price && price > 0) {
            currentPrice = price;
          }
        } catch (error) {
          console.error('Error getting price from API:', error);
        }
      }

      const isEquity = selectedCategory?.type?.name?.toLowerCase() === 'equity';
      
      const payload = {
        personId: selectedPersonId,
        categoryId: holdingFormData.categoryId,
        concept: isDolar ? 'USD' : holdingFormData.concept.trim(),
        currentAmount: parseDecimal(holdingFormData.currentAmount),
        currentPrice: currentPrice,
        originalAmount: isDolar ? parseDecimal(holdingFormData.currentAmount) : parseDecimal(holdingFormData.originalAmount),
        tag: isDolar ? undefined : (holdingFormData.tag.trim() || undefined),
        sector: isDolar ? undefined : (holdingFormData.sector.trim() || undefined),
        custodyEntity: holdingFormData.custodyEntity.trim() || undefined,
        date: holdingFormData.date,
        x100: isEquity ? holdingFormData.x100 : undefined,
        gbp: isEquity ? holdingFormData.gbp : undefined,
      };

      if (editingHoldingId) {
        await api.updateHolding(editingHoldingId, payload);
      } else {
        await api.createHolding(payload);
      }

      resetHoldingForm();
      await loadHoldings(selectedPersonId);
      setToast({
        message: editingHoldingId ? 'Tenencia actualizada exitosamente' : 'Tenencia creada exitosamente',
        type: 'success',
      });
    } catch (error) {
      console.error('Error saving holding:', error);
      setToast({
        message: 'Error al guardar la tenencia',
        type: 'error',
      });
    }
  }

  function handleEditHolding(holding) {
    setEditingHoldingId(holding.id);
    setHoldingFormData({
      categoryId: holding.categoryId,
      concept: holding.concept || '',
      currentAmount: formatDecimal(holding.currentAmount),
      currentPrice: holding.currentPrice ? formatDecimal(holding.currentPrice) : '',
      tag: holding.tag || '',
      sector: holding.sector || '',
      originalAmount: formatDecimal(holding.originalAmount),
      custodyEntity: holding.custodyEntity || '',
      date: holding.date ? new Date(holding.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      x100: holding.x100 || false,
      gbp: holding.gbp || false,
    });
    setShowHoldingForm(true);
  }

  function handleDeleteHoldingClick(holding) {
    setHoldingToDelete(holding);
    setShowDeleteHoldingModal(true);
  }

  async function confirmDeleteHolding() {
    if (!holdingToDelete) return;
    
    try {
      await api.deleteHolding(holdingToDelete.id);
      setToast({
        message: 'Tenencia eliminada exitosamente',
        type: 'success',
      });
      await loadHoldings(selectedPersonId);
      setShowDeleteHoldingModal(false);
      setHoldingToDelete(null);
    } catch (error) {
      console.error('Error deleting holding:', error);
      setToast({
        message: 'Error al eliminar la tenencia',
        type: 'error',
      });
    }
  }

  // Operation handlers (similar to Investment operations)
  async function handleAddOperation(holding) {
    setSelectedHoldingId(holding.id);
    const typeName = holding.category?.type?.name?.toLowerCase();
    const shouldSetPrice = typeName !== 'dolar' && holding.currentPrice;
    setOperationData({
      type: 'COMPRA',
      amount: '',
      price: shouldSetPrice ? formatDecimal(holding.currentPrice) : '',
      note: '',
      date: new Date().toISOString().split('T')[0],
    });
    setOperationAmountError(null);
    setShowOperationForm(true);
    await loadOperations(holding.id);
  }

  function handleOperationAmountChange(value) {
    const cleaned = value.replace(/[^0-9,.-]/g, '');
    const normalized = cleaned.replace('.', ',');
    
    setOperationData(prev => {
      const newData = { ...prev, amount: normalized };
      
      if (prev.type === 'VENTA' && normalized) {
        const selectedHolding = holdings.find(h => h.id === selectedHoldingId);
        if (selectedHolding) {
          const amountToSell = parseDecimal(normalized);
          if (!isNaN(amountToSell) && amountToSell > selectedHolding.currentAmount) {
            setOperationAmountError(`No puedes vender más de ${formatNumberWithConditionalDecimals(selectedHolding.currentAmount)}`);
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
    if (!selectedHoldingId) {
      setToast({
        message: 'Por favor selecciona una tenencia',
        type: 'warning',
      });
      return;
    }

    if (operationData.type === 'VENTA') {
      const selectedHolding = holdings.find(h => h.id === selectedHoldingId);
      if (selectedHolding) {
        const amountToSell = parseDecimal(operationData.amount);
        if (amountToSell > selectedHolding.currentAmount) {
          setToast({
            message: `No puedes vender más de lo que tienes. Cantidad disponible: ${formatNumberWithConditionalDecimals(selectedHolding.currentAmount)}`,
            type: 'error',
          });
          return;
        }
      }
    }

    try {
      const selectedHolding = holdings.find(h => h.id === selectedHoldingId);
      const typeName = selectedHolding?.category?.type?.name?.toLowerCase();
      const shouldSendPrice = typeName !== 'dolar' && operationData.price;
      
      await api.createHoldingOperation({
        holdingId: selectedHoldingId,
        type: operationData.type,
        amount: parseDecimal(operationData.amount),
        price: shouldSendPrice ? parseDecimal(operationData.price) : undefined,
        note: operationData.note || undefined,
        date: operationData.date,
      });
      await loadHoldings(selectedPersonId);
      await loadOperations(selectedHoldingId);
      setShowOperationForm(false);
      setSelectedHoldingId(null);
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

  // Render functions
  // Group holdings by concept
  function groupHoldingsByConcept(holdingsList) {
    const conceptMap = new Map();
    
    holdingsList.forEach(holding => {
      const concept = holding.concept || 'Sin concepto';
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, []);
      }
      conceptMap.get(concept).push(holding);
    });
    
    return Array.from(conceptMap.entries()).map(([concept, holdings]) => ({
      concept,
      holdings,
    }));
  }

  function toggleConceptExpansion(conceptKey) {
    setExpandedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptKey)) {
        next.delete(conceptKey);
      } else {
        next.add(conceptKey);
      }
      return next;
    });
  }

  function renderHoldingGroup(typeName, holdingsList) {
    if (holdingsList.length === 0) return null;

    const typeLabel = {
      dolar: 'Dólar',
      equity: 'Equity',
      crypto: 'Crypto',
    }[typeName] || typeName;

    // Group by concept
    let conceptGroups = groupHoldingsByConcept(holdingsList);
    
    // Filtrar por término de búsqueda si existe
    if (searchFilter.trim()) {
      const filterLower = searchFilter.trim().toLowerCase();
      conceptGroups = conceptGroups.filter(({ concept }) => 
        concept.toLowerCase().includes(filterLower)
      );
    }
    
    if (conceptGroups.length === 0) return null;
    
    // Sort concept groups by total value
    conceptGroups.sort((a, b) => {
      const totalA = a.holdings.reduce((sum, holding) => {
        let price = holding.currentPrice || 0;
        if (typeName === 'equity') {
          if (holding.x100) price = price / 100;
          if (holding.gbp && gbpPrice) price = price * gbpPrice;
        }
        const value = typeName === 'dolar' ? (holding.currentAmount || 0) : (holding.currentAmount || 0) * price;
        return sum + value;
      }, 0);
      const totalB = b.holdings.reduce((sum, holding) => {
        let price = holding.currentPrice || 0;
        if (typeName === 'equity') {
          if (holding.x100) price = price / 100;
          if (holding.gbp && gbpPrice) price = price * gbpPrice;
        }
        const value = typeName === 'dolar' ? (holding.currentAmount || 0) : (holding.currentAmount || 0) * price;
        return sum + value;
      }, 0);
      return totalB - totalA;
    });

    const sortedHoldings = [...holdingsList];
    if (typeName === 'crypto' || typeName === 'equity') {
      sortedHoldings.sort((a, b) => {
        let priceA = a.currentPrice || 0;
        let priceB = b.currentPrice || 0;
        if (typeName === 'equity') {
          if (a.x100) priceA = priceA / 100;
          if (b.x100) priceB = priceB / 100;
          if (a.gbp && gbpPrice) priceA = priceA * gbpPrice;
          if (b.gbp && gbpPrice) priceB = priceB * gbpPrice;
        }
        const valueA = (a.currentAmount || 0) * priceA;
        const valueB = (b.currentAmount || 0) * priceB;
        return valueB - valueA;
      });
    } else if (typeName === 'dolar') {
      sortedHoldings.sort((a, b) => {
        const amountA = a.currentAmount || 0;
        const amountB = b.currentAmount || 0;
        return amountB - amountA;
      });
    }

    return (
      <Card key={typeName} title={typeLabel} className="mb-6">
        <div className="space-y-4">
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
                  {typeName !== 'dolar' && (() => {
                    const hasAnyExpanded = Array.from(expandedConcepts).some(key => key.startsWith(`${typeName}-`));
                    return hasAnyExpanded ? (
                      <th className="text-left py-2 px-3 text-sm font-semibold">Mercado</th>
                    ) : null;
                  })()}
                  {typeName !== 'dolar' && (() => {
                    const hasAnyExpanded = Array.from(expandedConcepts).some(key => key.startsWith(`${typeName}-`));
                    return hasAnyExpanded ? (
                      <th className="text-left py-2 px-3 text-sm font-semibold">Sector</th>
                    ) : null;
                  })()}
                  {(() => {
                    const hasAnyExpanded = Array.from(expandedConcepts).some(key => key.startsWith(`${typeName}-`));
                    return hasAnyExpanded ? (
                      <th className="text-center py-2 px-3 text-sm font-semibold">Acciones</th>
                    ) : null;
                  })()}
                </tr>
              </thead>
              <tbody>
                {conceptGroups.map(({ concept, holdings: conceptHoldings }) => {
                  const conceptKey = `${typeName}-${concept}`;
                  const isExpanded = expandedConcepts.has(conceptKey);
                  const hasAnyExpanded = Array.from(expandedConcepts).some(key => key.startsWith(`${typeName}-`));
                  
                  // Sort holdings within concept
                  const sortedConceptHoldings = [...conceptHoldings];
                  if (typeName === 'crypto' || typeName === 'equity') {
                    sortedConceptHoldings.sort((a, b) => {
                      let priceA = a.currentPrice || 0;
                      let priceB = b.currentPrice || 0;
                      if (typeName === 'equity') {
                        if (a.x100) priceA = priceA / 100;
                        if (b.x100) priceB = priceB / 100;
                        if (a.gbp && gbpPrice) priceA = priceA * gbpPrice;
                        if (b.gbp && gbpPrice) priceB = priceB * gbpPrice;
                      }
                      const valueA = (a.currentAmount || 0) * priceA;
                      const valueB = (b.currentAmount || 0) * priceB;
                      return valueB - valueA;
                    });
                  } else if (typeName === 'dolar') {
                    sortedConceptHoldings.sort((a, b) => {
                      const amountA = a.currentAmount || 0;
                      const amountB = b.currentAmount || 0;
                      return amountB - amountA;
                    });
                  }
                  
                  // Calculate totals for concept
                  const conceptTotalCurrent = conceptHoldings.reduce((sum, holding) => {
                    let price = holding.currentPrice || 0;
                    if (typeName === 'equity') {
                      if (holding.x100) price = price / 100;
                      if (holding.gbp && gbpPrice) price = price * gbpPrice;
                    }
                    const currentValue = typeName === 'dolar' ? (holding.currentAmount || 0) : (holding.currentAmount || 0) * price;
                    return sum + currentValue;
                  }, 0);
                  
                  const conceptTotalAmount = conceptHoldings.reduce((sum, holding) => sum + (holding.currentAmount || 0), 0);
                  
                  // Calculate average price for concept (if all have the same price, show it)
                  let conceptPrice = null;
                  if (typeName !== 'dolar' && conceptHoldings.length > 0) {
                    const prices = conceptHoldings.map(holding => {
                      let price = holding.currentPrice || 0;
                      if (typeName === 'equity') {
                        if (holding.x100) price = price / 100;
                        if (holding.gbp && gbpPrice) price = price * gbpPrice;
                      }
                      return price;
                    }).filter(p => p > 0);
                    
                    if (prices.length > 0) {
                      // Check if all prices are the same (within a small tolerance)
                      const firstPrice = prices[0];
                      const allSame = prices.every(p => Math.abs(p - firstPrice) < 0.01);
                      if (allSame) {
                        conceptPrice = firstPrice;
                      }
                    }
                  }
                  
                  return (
                    <React.Fragment key={conceptKey}>
                      {/* Concept Summary Row */}
                      <tr 
                        className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => toggleConceptExpansion(conceptKey)}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                              chevron_right
                            </span>
                            <span className="font-semibold">{concept}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({conceptHoldings.length} {conceptHoldings.length === 1 ? 'tenencia' : 'tenencias'})
                            </span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-3 font-semibold">
                          {formatNumberWithConditionalDecimals(conceptTotalAmount)}
                        </td>
                        {typeName !== 'dolar' && (
                          <td className="text-right py-2 px-3 font-semibold">
                            {conceptPrice !== null ? formatMoneyWithConditionalDecimals(conceptPrice, 'ARS', { sign: 'none' }) : '-'}
                          </td>
                        )}
                        {(typeName === 'crypto' || typeName === 'equity') && (
                          <td className="text-right py-2 px-3 font-semibold">
                            {formatMoneyWithConditionalDecimals(conceptTotalCurrent, 'ARS', { sign: 'none' })}
                          </td>
                        )}
                        {typeName !== 'dolar' && hasAnyExpanded && (
                          <td className="py-2 px-3">-</td>
                        )}
                        {typeName !== 'dolar' && hasAnyExpanded && (
                          <td className="py-2 px-3">-</td>
                        )}
                        {hasAnyExpanded && (
                          <td className="text-center py-2 px-3">-</td>
                        )}
                      </tr>
                      
                      {/* Expanded Detail Rows */}
                      {isExpanded && sortedConceptHoldings.map(holding => {
                        let displayPrice = holding.currentPrice || 0;
                        let displayAmount = holding.currentAmount || 0;
                        
                        if (typeName === 'equity') {
                          if (holding.x100) {
                            displayPrice = displayPrice / 100;
                          }
                          if (holding.gbp && gbpPrice) {
                            displayPrice = displayPrice * gbpPrice;
                          }
                        }
                        
                        const currentValue = displayAmount * displayPrice;
                        const holdingOperations = operations[holding.id] || [];
                        const purchaseCost = holdingOperations
                          .filter(op => op.type === 'COMPRA' && op.price && op.price > 0)
                          .reduce((total, op) => {
                            let opPrice = op.price;
                            if (typeName === 'equity' && holding.x100) {
                              opPrice = opPrice / 100;
                            }
                            if (typeName === 'equity' && holding.gbp && gbpPrice) {
                              opPrice = opPrice * gbpPrice;
                            }
                            return total + (opPrice * op.amount);
                          }, 0);
                        const costBasis = (holding.originalAmount || 0) + purchaseCost;
                        const gain = currentValue - costBasis;
                        return (
                          <tr key={holding.id} className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                            <td className="py-2 px-3 pl-8">
                              {holding.concept}
                            </td>
                            <td className="text-right py-2 px-3">{formatNumberWithConditionalDecimals(displayAmount)}</td>
                            {typeName !== 'dolar' && (
                              <td className="text-right py-2 px-3">{displayPrice > 0 ? formatMoneyWithConditionalDecimals(displayPrice, 'ARS', { sign: 'none' }) : '-'}</td>
                            )}
                            {(typeName === 'crypto' || typeName === 'equity') && (
                              <td className="text-right py-2 px-3 font-semibold">
                                {formatMoneyWithConditionalDecimals(currentValue, 'ARS', { sign: 'none' })}
                              </td>
                            )}
                            {typeName !== 'dolar' && hasAnyExpanded && (
                              <td className="py-2 px-3">{holding.tag || '-'}</td>
                            )}
                            {typeName !== 'dolar' && hasAnyExpanded && (
                              <td className="py-2 px-3">{holding.sector || '-'}</td>
                            )}
                            {hasAnyExpanded && (
                              <td className="text-center py-2 px-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleEditHolding(holding); }}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                                    title="Editar"
                                  >
                                    Editar
                                  </button>
                                  <span className="text-gray-300 dark:text-gray-600">|</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteHoldingClick(holding); }}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                                    title="Eliminar"
                                  >
                                    Eliminar
                                  </button>
                                  <span className="text-gray-300 dark:text-gray-600">|</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAddOperation(holding); }}
                                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-sm"
                                    title="Agregar Operación"
                                  >
                                    Operación
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
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

  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-4xl font-black tracking-[-0.033em]">Tenencias</p>
          <p className="text-[#616f89] dark:text-gray-400">Gestiona las tenencias por persona</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">GBP/USD</p>
            <p className="text-sm font-semibold">
              {gbpPrice ? gbpPrice.toFixed(4) : 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPersonId && (
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
            )}
            <button
              onClick={() => setShowPersonForm(true)}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Agregar Persona
            </button>
            {selectedPersonId && (
              <button
                onClick={() => setShowHoldingForm(true)}
                className="h-9 px-4 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
              >
                Agregar Tenencia
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Person Form Modal */}
      {showPersonForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={resetPersonForm}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {editingPersonId ? 'Editar Persona' : 'Nueva Persona'}
                </h3>
                <button
                  onClick={resetPersonForm}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <form onSubmit={handlePersonSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={personFormData.name}
                    onChange={(e) => handlePersonFormChange('name', e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
                  >
                    {editingPersonId ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetPersonForm}
                    className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Person Selection */}
      <Card title="Seleccionar Persona">
        <div className="space-y-4">
          {persons.length === 0 ? (
            <p className="text-center text-gray-500">No hay personas registradas. Agrega tu primera persona.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {persons.map(person => (
                <div
                  key={person.id}
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPersonId === person.id
                      ? 'border-primary bg-primary/10 dark:bg-primary/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{person.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {holdings.length} tenencia{holdings.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPerson(person);
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                        title="Editar"
                      >
                        Editar
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePersonClick(person);
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        title="Eliminar"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Holdings for selected person */}
      {selectedPersonId && selectedPerson && (
        <Card title={`Tenencias de ${selectedPerson.name}`}>
          {loading ? (
            <p className="text-center text-gray-500">Cargando...</p>
          ) : (
            <>
              {renderHoldingGroup('dolar', groupedHoldings.dolar)}
              {renderHoldingGroup('equity', groupedHoldings.equity)}
              {renderHoldingGroup('crypto', groupedHoldings.crypto)}
              
              {holdings.length === 0 && (
                <p className="text-center text-gray-500">No hay tenencias registradas para esta persona. Agrega tu primera tenencia.</p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Holding Form - Similar to Investment form but simplified for space */}
      {showHoldingForm && selectedPersonId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          resetHoldingForm();
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {editingHoldingId ? 'Editar Tenencia' : 'Nueva Tenencia'}
                </h3>
                <button
                  onClick={resetHoldingForm}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <form onSubmit={handleHoldingSubmit} className="space-y-4">
                {/* Similar form fields to Investment.jsx - simplified for space */}
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Inversión *</label>
                  <CustomSelect
                    value={holdingFormData.categoryId || ''}
                    onChange={(v) => handleHoldingFormChange('categoryId', v)}
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

                {(() => {
                  const selectedCategory = investmentCategories.find(cat => cat.id === holdingFormData.categoryId);
                  const isDolar = selectedCategory?.type?.name?.toLowerCase() === 'dolar';
                  
                  return (
                    <>
                      {!isDolar && (
                        <div className="relative">
                          <label className="block text-sm font-medium mb-1">Concepto *</label>
                          <input
                            type="text"
                            value={holdingFormData.concept}
                            onChange={(e) => handleHoldingFormChange('concept', e.target.value)}
                            onFocus={() => {
                              if (holdingFormData.concept && holdingFormData.concept.length > 0) {
                                if (filteredSymbols.length > 0) {
                                  setShowSymbolSuggestions(true);
                                } else if (availableSymbols.length > 0) {
                                  setFilteredSymbols(availableSymbols);
                                  setShowSymbolSuggestions(true);
                                }
                              } else if (availableSymbols.length > 0) {
                                setFilteredSymbols(availableSymbols);
                                setShowSymbolSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowSymbolSuggestions(false), 200);
                            }}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Ej: BTC, USD, AAPL"
                            required={!isDolar}
                          />
                          {showSymbolSuggestions && filteredSymbols.length > 0 && (
                            <div 
                              className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {filteredSymbols.slice(0, 10).map((symbol) => (
                                <div
                                  key={symbol}
                                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleHoldingFormChange('concept', symbol);
                                    setShowSymbolSuggestions(false);
                                  }}
                                >
                                  {symbol}
                                </div>
                              ))}
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
                            value={holdingFormData.currentAmount}
                            onChange={(e) => handleHoldingFormChange('currentAmount', e.target.value)}
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
                            value={holdingFormData.currentAmount}
                            onChange={(e) => handleHoldingFormChange('currentAmount', e.target.value)}
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
                            value={holdingFormData.originalAmount}
                            onChange={(e) => handleHoldingFormChange('originalAmount', e.target.value)}
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
                          value={holdingFormData.date}
                          onChange={(e) => handleHoldingFormChange('date', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                          required
                        />
                      </div>

                      {!isDolar && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Mercado</label>
                          <input
                            type="text"
                            value={holdingFormData.tag}
                            onChange={(e) => handleHoldingFormChange('tag', e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Opcional"
                          />
                        </div>
                      )}

                      {!isDolar && (
                        <div>
                          <label className="block text-sm font-medium mb-1">Sector</label>
                          <input
                            type="text"
                            value={holdingFormData.sector}
                            onChange={(e) => handleHoldingFormChange('sector', e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Opcional"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium mb-1">Entidad de Custodia{isDolar ? ' *' : ''}</label>
                        <input
                          type="text"
                          value={holdingFormData.custodyEntity}
                          onChange={(e) => handleHoldingFormChange('custodyEntity', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Ej: Binance, IOL, etc."
                          required={isDolar}
                        />
                      </div>

                      {selectedCategory?.type?.name?.toLowerCase() === 'equity' && (
                        <>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="x100"
                              checked={holdingFormData.x100}
                              onChange={(e) => handleHoldingFormChange('x100', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-primary focus:ring-primary"
                            />
                            <label htmlFor="x100" className="text-sm font-medium cursor-pointer">
                              X100: Dividir precio actual por 100
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="gbp"
                              checked={holdingFormData.gbp}
                              onChange={(e) => handleHoldingFormChange('gbp', e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-primary focus:ring-primary"
                            />
                            <label htmlFor="gbp" className="text-sm font-medium cursor-pointer">
                              GBP: Convertir valores a dólares usando libra esterlina
                            </label>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
                  >
                    {editingHoldingId ? 'Actualizar' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetHoldingForm}
                    className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Operation Form Modal - Similar to Investment operation form */}
      {showOperationForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => {
          setShowOperationForm(false);
          setSelectedHoldingId(null);
          setOperationData({ type: 'COMPRA', amount: '', price: '', note: '', date: new Date().toISOString().split('T')[0] });
        }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Agregar Operación
                </h3>
                <button
                  onClick={() => {
                    setShowOperationForm(false);
                    setSelectedHoldingId(null);
                    setOperationData({ type: 'COMPRA', amount: '', price: '', note: '', date: new Date().toISOString().split('T')[0] });
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <form onSubmit={handleOperationSubmit} className="space-y-4">
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
                </div>
                {selectedHoldingId && (() => {
                  const selectedHolding = holdings.find(h => h.id === selectedHoldingId);
                  const typeName = selectedHolding?.category?.type?.name?.toLowerCase();
                  if (typeName === 'dolar') {
                    return null;
                  }
                  return (
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
                  );
                })()}
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
                      setSelectedHoldingId(null);
                      setOperationData({ type: 'COMPRA', amount: '', price: '', note: '', date: new Date().toISOString().split('T')[0] });
                    }}
                    className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modals */}
      {showDeletePersonModal && personToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeletePersonModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Confirmar Eliminación
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que deseas eliminar a <span className="font-semibold text-gray-900 dark:text-gray-100">"{personToDelete.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Esta acción eliminará todas las tenencias asociadas y no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeletePersonModal(false)}
                  className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeletePerson}
                  className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteHoldingModal && holdingToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteHoldingModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Confirmar Eliminación
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ¿Estás seguro de que deseas eliminar la tenencia <span className="font-semibold text-gray-900 dark:text-gray-100">"{holdingToDelete.concept}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteHoldingModal(false)}
                  className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteHolding}
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

