import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import Card from '../components/Card.jsx';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import * as api from '../api/index.js';
import { capitalizeWords, formatNumber } from '../utils/format.js';

function useFAConfig(categories) {
  // Store categories in ref to access in toggle
  const categoriesRef = React.useRef(categories);
  React.useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  const [config, setConfig] = React.useState({
    fixed: [],
    wellbeing: [],
    saving: [],
    targets: { fixed: 50, wellbeing: 30, saving: 20 },
  });
  // Store config in ref to access latest state
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);
  
  const [loading, setLoading] = React.useState(true);

  // Load config from API on mount
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api.getFAConfig();
        // Normalize category names when loading from API
        const normalizeArray = (arr) => {
          if (!Array.isArray(arr)) return [];
          return arr.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
        };
        setConfig({
          fixed: normalizeArray(data.fixed || []),
          wellbeing: normalizeArray(data.wellbeing || []),
          saving: normalizeArray(data.saving || []),
          targets: {
            fixed: data.targets?.fixed ?? 50,
            wellbeing: data.targets?.wellbeing ?? 30,
            saving: data.targets?.saving ?? 20,
          },
        });
      } catch (err) {
        console.error('Error loading FA config:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = React.useCallback(async (next) => {
    // Normalize before saving
    const normalizeArray = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.map(item => String(item || '').trim().toLowerCase()).filter(Boolean);
    };
    const normalized = {
      fixed: normalizeArray(next.fixed || []),
      wellbeing: normalizeArray(next.wellbeing || []),
      saving: normalizeArray(next.saving || []),
      targets: next.targets || { fixed: 50, wellbeing: 30, saving: 20 },
    };
    setConfig(normalized);
    try {
      // Transform to API format
      const response = await api.updateFAConfig({
        fixed: normalized.fixed || [],
        wellbeing: normalized.wellbeing || [],
        saving: normalized.saving || [],
        targetFixed: normalized.targets?.fixed ?? 50,
        targetWellbeing: normalized.targets?.wellbeing ?? 30,
        targetSaving: normalized.targets?.saving ?? 20,
      });
      // Normalize response if API returns data
      if (response) {
        setConfig({
          fixed: normalizeArray(response.fixed || []),
          wellbeing: normalizeArray(response.wellbeing || []),
          saving: normalizeArray(response.saving || []),
          targets: {
            fixed: response.targets?.fixed ?? 50,
            wellbeing: response.targets?.wellbeing ?? 30,
            saving: response.targets?.saving ?? 20,
          },
        });
      }
    } catch (err) {
      console.error('Error saving FA config:', err);
    }
  }, []);

  const toggle = (bucket, categoryName) => {
    const lower = String(categoryName || '').trim().toLowerCase();
    const current = new Set(config[bucket] || []);
    if (current.has(lower)) current.delete(lower); else current.add(lower);
    const next = { ...config, [bucket]: Array.from(current) };
    save(next);
  };

  const autoCompleteThirdBucket = React.useCallback(() => {
    // Use ref to get latest config state
    const currentConfig = configRef.current;
    const allBuckets = ['fixed', 'wellbeing', 'saving'];
    const bucketsWithCategories = allBuckets.filter(b => (currentConfig[b] || []).length > 0);
    
    if (bucketsWithCategories.length === 2) {
      // Find the empty bucket
      const emptyBucket = allBuckets.find(b => (currentConfig[b] || []).length === 0);
      if (emptyBucket) {
        // Get all available categories (excluding "general")
        const allCategoryNames = (categoriesRef.current || [])
          .map(c => String(c.name || '').trim().toLowerCase())
          .filter(n => n !== 'general');
        
        // Get categories already in the 2 filled buckets
        const selectedInFilledBuckets = new Set();
        bucketsWithCategories.forEach(b => {
          (currentConfig[b] || []).forEach(cat => selectedInFilledBuckets.add(cat));
        });
        
        // Add remaining categories to the empty bucket
        const remainingCategories = allCategoryNames.filter(cat => !selectedInFilledBuckets.has(cat));
        const next = { ...currentConfig, [emptyBucket]: remainingCategories };
        
        // Save to API (save will update the state)
        save(next);
      }
    }
  }, [save]);

  const setTarget = (bucket, value) => {
    const num = Number(value || 0);
    // Round to 2 decimal places and clamp between 0-100
    const v = Math.max(0, Math.min(100, Math.round(num * 100) / 100));
    save({ ...config, targets: { ...config.targets, [bucket]: v } });
  };

  const formatTargetValue = (value) => {
    const num = Number(value || 0);
    // Show as integer if it's a whole number, otherwise 2 decimals
    return num % 1 === 0 ? num.toString() : formatNumber(num, 2);
  };

  const allCategoryNames = React.useMemo(() => {
    const excludedCategories = ['general', 'crypto', 'dolar', 'equity'];
    return (categories || [])
      .map(c => String(c.name || '').trim().toLowerCase())
      .filter(n => !excludedCategories.includes(n)); // Exclude "general", "crypto", "dolar", and "equity" categories
  }, [categories]);

  // Ensure config only keeps categories that exist (guard against renames)
  React.useEffect(() => {
    if (loading) return; // Don't save while loading
    const cleanse = (list) => Array.from(new Set(list.map(n => String(n || '').trim().toLowerCase()))).filter(n => allCategoryNames.includes(n));
    const next = { 
      fixed: cleanse(config.fixed), 
      wellbeing: cleanse(config.wellbeing), 
      saving: cleanse(config.saving), 
      targets: config.targets
    };
    if (JSON.stringify(next) !== JSON.stringify(config)) {
      // Update state and save to API
      setConfig(next);
      (async () => {
        try {
          await api.updateFAConfig({
            fixed: next.fixed || [],
            wellbeing: next.wellbeing || [],
            saving: next.saving || [],
            targetFixed: next.targets?.fixed ?? 50,
            targetWellbeing: next.targets?.wellbeing ?? 30,
            targetSaving: next.targets?.saving ?? 20,
          });
        } catch (err) {
          console.error('Error saving FA config:', err);
        }
      })();
    }
    // eslint-disable-next-line
  }, [allCategoryNames.join('|'), loading]);

  return { config, toggle, setTarget, formatTargetValue, loading, autoCompleteThirdBucket };
}

function buildYearlyPercents(expenses, config) {
  // Build totals per year
  const yearTotals = new Map();
  const yearBucket = new Map(); // year -> {fixed, wellbeing, saving}

  // Debug: log config
  if (expenses && expenses.length > 0 && (config.fixed?.length > 0 || config.wellbeing?.length > 0 || config.saving?.length > 0)) {
    console.log('FA Config:', {
      fixed: config.fixed,
      wellbeing: config.wellbeing,
      saving: config.saving,
    });
  }

  // Categories to exclude from financial analysis
  const excludedCategories = ['crypto', 'dolar', 'equity'];
  
  for (const e of (expenses || [])) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    
    // Include all data, including forecast months
    const amount = Number(e.amount || 0);
    const cat = (typeof e.category === 'object' && e.category) ? (e.category.name || '') : (e.category || '');
    const lowerCat = String(cat).trim().toLowerCase();
    
    // Exclude crypto, dolar, and equity categories
    if (excludedCategories.includes(lowerCat)) continue;

    yearTotals.set(year, (yearTotals.get(year) || 0) + amount);
    const buckets = yearBucket.get(year) || { fixed: 0, wellbeing: 0, saving: 0 };
    
    // Debug first few expenses
    if (yearTotals.get(year) === amount) {
      console.log('Processing expense:', {
        category: cat,
        lowerCat,
        inFixed: config.fixed?.includes(lowerCat),
        inWellbeing: config.wellbeing?.includes(lowerCat),
        inSaving: config.saving?.includes(lowerCat),
      });
    }
    
    if (config.fixed && Array.isArray(config.fixed) && config.fixed.includes(lowerCat)) buckets.fixed += amount;
    if (config.wellbeing && Array.isArray(config.wellbeing) && config.wellbeing.includes(lowerCat)) buckets.wellbeing += amount;
    if (config.saving && Array.isArray(config.saving) && config.saving.includes(lowerCat)) buckets.saving += amount;
    yearBucket.set(year, buckets);
  }

  // Produce series sorted by year asc
  const years = Array.from(yearTotals.keys()).sort((a, b) => a - b);
  return years.map((y) => {
    const total = yearTotals.get(y) || 0;
    const b = yearBucket.get(y) || { fixed: 0, wellbeing: 0, saving: 0 };
    const safePct = (num) => (total !== 0 ? (num / total) * 100 : 0);
    return {
      year: String(y),
      fixed: Number(safePct(b.fixed).toFixed(2).replace(',', '.')),
      wellbeing: Number(safePct(b.wellbeing).toFixed(2).replace(',', '.')),
      saving: Number(safePct(b.saving).toFixed(2).replace(',', '.')),
    };
  });
}

function buildYearlyPercentsByCategory(expenses, config, bucket) {
  // Build totals per year per category for a specific bucket
  const yearTotals = new Map();
  const yearCategory = new Map(); // year -> { categoryName: amount }

  const excludedCategories = ['crypto', 'dolar', 'equity'];
  const bucketCategories = config[bucket] || [];

  for (const e of (expenses || [])) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    
    const amount = Number(e.amount || 0);
    const cat = (typeof e.category === 'object' && e.category) ? (e.category.name || '') : (e.category || '');
    const lowerCat = String(cat).trim().toLowerCase();
    
    if (excludedCategories.includes(lowerCat)) continue;
    if (!bucketCategories.includes(lowerCat)) continue;

    yearTotals.set(year, (yearTotals.get(year) || 0) + amount);
    
    const yearData = yearCategory.get(year) || {};
    yearData[lowerCat] = (yearData[lowerCat] || 0) + amount;
    yearCategory.set(year, yearData);
  }

  const years = Array.from(yearTotals.keys()).sort((a, b) => a - b);
  const allCategories = new Set();
  years.forEach(y => {
    Object.keys(yearCategory.get(y) || {}).forEach(cat => allCategories.add(cat));
  });

  return years.map((y) => {
    const total = yearTotals.get(y) || 0;
    const yearData = yearCategory.get(y) || {};
    const safePct = (num) => (total !== 0 ? (num / total) * 100 : 0);
    
    const result = { year: String(y) };
    allCategories.forEach(cat => {
      result[cat] = Number(safePct(yearData[cat] || 0).toFixed(2).replace(',', '.'));
    });
    return result;
  });
}

export default function FinancialAnalysis() {
  const { expenses, categories, t } = useApp();
  const { config, toggle, setTarget, formatTargetValue, loading, autoCompleteThirdBucket } = useFAConfig(categories);
  const [editingTarget, setEditingTarget] = React.useState({ bucket: null, value: '' });
  const [collapsed, setCollapsed] = React.useState({ fixed: false, wellbeing: false, saving: false });
  const [detailView, setDetailView] = React.useState(null); // null, 'fixed', 'wellbeing', or 'saving'
  const hasInitializedCollapsed = React.useRef(false);

  // If there's a saved configuration, collapse all sections by default (only once on initial load)
  React.useEffect(() => {
    if (loading || hasInitializedCollapsed.current) return; // Wait for config to load and only run once
    
    // Check if there's a saved configuration (not default)
    const hasSavedConfig = 
      (config.fixed && config.fixed.length > 0) ||
      (config.wellbeing && config.wellbeing.length > 0) ||
      (config.saving && config.saving.length > 0) ||
      (config.targets?.fixed !== 50) ||
      (config.targets?.wellbeing !== 30) ||
      (config.targets?.saving !== 20);
    
    if (hasSavedConfig) {
      setCollapsed({ fixed: true, wellbeing: true, saving: true });
    }
    hasInitializedCollapsed.current = true;
  }, [config, loading]);

  const series = React.useMemo(() => {
    if (detailView) {
      return buildYearlyPercentsByCategory(expenses, config, detailView);
    }
    return buildYearlyPercents(expenses, config);
  }, [expenses, config, detailView]);
  
  const currentYear = new Date().getFullYear();
  const current = series.find(s => Number(s.year) === currentYear) || { fixed: 0, wellbeing: 0, saving: 0 };
  const deviation = {
    fixed: Number((current.fixed - (config.targets.fixed || 0)).toFixed(2).replace(',', '.')),
    wellbeing: Number((current.wellbeing - (config.targets.wellbeing || 0)).toFixed(2).replace(',', '.')),
    saving: Number((current.saving - (config.targets.saving || 0)).toFixed(2).replace(',', '.')),
  };

  const catList = (bucket) => {
    // Get all categories selected in other buckets
    const otherBuckets = ['fixed', 'wellbeing', 'saving'].filter(b => b !== bucket);
    const selectedInOthers = new Set();
    otherBuckets.forEach(b => {
      (config[b] || []).forEach(cat => selectedInOthers.add(cat));
    });

    // Filter categories: show only if not selected in other buckets, or already selected in current bucket
    // Also filter out "General", "crypto", "dolar", and "equity" categories
    const excludedCategories = ['general', 'crypto', 'dolar', 'equity'];
    return (categories || [])
      .filter((c) => {
        const lower = String(c.name || '').trim().toLowerCase();
        // Filter out excluded categories
        if (excludedCategories.includes(lower)) return false;
        const isInCurrent = (config[bucket] || []).includes(lower);
        const isInOthers = selectedInOthers.has(lower);
        // Show if it's in current bucket OR not in any other bucket
        return isInCurrent || !isInOthers;
      })
      .map((c) => {
        const lower = String(c.name || '').trim().toLowerCase();
        const checked = (config[bucket] || []).includes(lower);
        const displayName = capitalizeWords(c.name);
        return (
          <label key={`${bucket}-${lower}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" checked={checked} onChange={() => toggle(bucket, lower)} />
            <span className="text-sm">{displayName}</span>
          </label>
        );
      });
  };

  const bucketSummary = (bucket) => {
    const sel = (config[bucket] || []);
    const shown = sel
      .slice(0, 5)
      .map(capitalizeWords)
      .join(', ');
    const extra = sel.length > 5 ? ` +${sel.length - 5}` : '';
    return (
      <div className="text-sm text-[#616f89] dark:text-gray-400">
        <span className="font-medium">{sel.length}</span> {t('category') || 'Categoría'}{sel.length === 1 ? '' : 's'}
        {sel.length > 0 && (
          <span className="ml-2 opacity-80">({shown}{extra})</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-4xl font-black tracking-[-0.033em]">{t('financialAnalysis') || 'Análisis financiero'}</p>
        <p className="text-[#616f89] dark:text-gray-400">{t('financialAnalysisSubtitle') || 'Configurar buckets y comparar contra objetivos (sobre gastos)'}</p>
      </header>

      <Card title={t('categoriesConfig') || 'Configuración de categorías'}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 
                className={`font-semibold ${collapsed.fixed ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={collapsed.fixed ? () => setCollapsed((s) => ({ ...s, fixed: false })) : undefined}
              >
                {t('fixedExpense') || 'Gasto fijo'}
              </h3>
              {config.fixed && config.fixed.length > 0 && (
                <button
                  onClick={() => setDetailView('fixed')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  title="Ver detalle en gráfico"
                >
                  Ver detalle →
                </button>
              )}
            </div>
            {!collapsed.fixed ? (
              <div className="rounded border border-gray-200 dark:border-gray-700">
                {catList('fixed')}
              </div>
            ) : (
              bucketSummary('fixed')
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-[#616f89]">{t('target') || 'Objetivo'}:</span>
              {collapsed.fixed ? (
                <span className="text-sm font-semibold">{formatTargetValue(config.targets.fixed)}%</span>
              ) : (
                <>
                  <input type="number" step="0.01" className="w-20 form-input rounded bg-gray-100 dark:bg-gray-800 border-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    style={{ WebkitAppearance: 'textfield', MozAppearance: 'textfield' }}
                    value={editingTarget.bucket === 'fixed' ? editingTarget.value : formatTargetValue(config.targets.fixed)}
                    onChange={(e) => {
                      setEditingTarget({ bucket: 'fixed', value: e.target.value });
                      setTarget('fixed', e.target.value);
                    }}
                    onBlur={() => {
                      setTarget('fixed', editingTarget.bucket === 'fixed' ? editingTarget.value : config.targets.fixed);
                      setEditingTarget({ bucket: null, value: '' });
                    }}
                    onFocus={(e) => setEditingTarget({ bucket: 'fixed', value: e.target.value })}
                    min={0} max={100} />
                  <span className="text-sm text-[#616f89]">%</span>
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => {
                    autoCompleteThirdBucket();
                    setCollapsed((s) => ({ ...s, fixed: true }));
                  }}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 
                className={`font-semibold ${collapsed.wellbeing ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={collapsed.wellbeing ? () => setCollapsed((s) => ({ ...s, wellbeing: false })) : undefined}
              >
                {t('wellbeing') || 'Bienestar'}
              </h3>
              {config.wellbeing && config.wellbeing.length > 0 && (
                <button
                  onClick={() => setDetailView('wellbeing')}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline"
                  title="Ver detalle en gráfico"
                >
                  Ver detalle →
                </button>
              )}
            </div>
            {!collapsed.wellbeing ? (
              <div className="rounded border border-gray-200 dark:border-gray-700">
                {catList('wellbeing')}
              </div>
            ) : (
              bucketSummary('wellbeing')
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-[#616f89]">{t('target') || 'Objetivo'}:</span>
              {collapsed.wellbeing ? (
                <span className="text-sm font-semibold">{formatTargetValue(config.targets.wellbeing)}%</span>
              ) : (
                <>
                  <input type="number" step="0.01" className="w-20 form-input rounded bg-gray-100 dark:bg-gray-800 border-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    style={{ WebkitAppearance: 'textfield', MozAppearance: 'textfield' }}
                    value={editingTarget.bucket === 'wellbeing' ? editingTarget.value : formatTargetValue(config.targets.wellbeing)}
                    onChange={(e) => {
                      setEditingTarget({ bucket: 'wellbeing', value: e.target.value });
                      setTarget('wellbeing', e.target.value);
                    }}
                    onBlur={() => {
                      setTarget('wellbeing', editingTarget.bucket === 'wellbeing' ? editingTarget.value : config.targets.wellbeing);
                      setEditingTarget({ bucket: null, value: '' });
                    }}
                    onFocus={(e) => setEditingTarget({ bucket: 'wellbeing', value: e.target.value })}
                    min={0} max={100} />
                  <span className="text-sm text-[#616f89]">%</span>
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => {
                    autoCompleteThirdBucket();
                    setCollapsed((s) => ({ ...s, wellbeing: true }));
                  }}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 
                className={`font-semibold ${collapsed.saving ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={collapsed.saving ? () => setCollapsed((s) => ({ ...s, saving: false })) : undefined}
              >
                {t('saving') || 'Ahorro'}
              </h3>
              {config.saving && config.saving.length > 0 && (
                <button
                  onClick={() => setDetailView('saving')}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  title="Ver detalle en gráfico"
                >
                  Ver detalle →
                </button>
              )}
            </div>
            {!collapsed.saving ? (
              <div className="rounded border border-gray-200 dark:border-gray-700">
                {catList('saving')}
              </div>
            ) : (
              bucketSummary('saving')
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-[#616f89]">{t('target') || 'Objetivo'}:</span>
              {collapsed.saving ? (
                <span className="text-sm font-semibold">{formatTargetValue(config.targets.saving)}%</span>
              ) : (
                <>
                  <input type="number" step="0.01" className="w-20 form-input rounded bg-gray-100 dark:bg-gray-800 border-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    style={{ WebkitAppearance: 'textfield', MozAppearance: 'textfield' }}
                    value={editingTarget.bucket === 'saving' ? editingTarget.value : formatTargetValue(config.targets.saving)}
                    onChange={(e) => {
                      setEditingTarget({ bucket: 'saving', value: e.target.value });
                      setTarget('saving', e.target.value);
                    }}
                    onBlur={() => {
                      setTarget('saving', editingTarget.bucket === 'saving' ? editingTarget.value : config.targets.saving);
                      setEditingTarget({ bucket: null, value: '' });
                    }}
                    onFocus={(e) => setEditingTarget({ bucket: 'saving', value: e.target.value })}
                    min={0} max={100} />
                  <span className="text-sm text-[#616f89]">%</span>
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => {
                    autoCompleteThirdBucket();
                    setCollapsed((s) => ({ ...s, saving: true }));
                  }}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={(t('yearlyBreakdown') || 'Desglose anual') + ' (%)'}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {detailView && (
              <button
                onClick={() => setDetailView(null)}
                className="h-8 px-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                ← Volver a vista general
              </button>
            )}
          </div>
          {!detailView && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Ver en detalle:</span>
              <button
                onClick={() => setDetailView('fixed')}
                className="px-3 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-sm"
                disabled={!config.fixed || config.fixed.length === 0}
              >
                Fijo
              </button>
              <button
                onClick={() => setDetailView('wellbeing')}
                className="px-3 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 text-sm"
                disabled={!config.wellbeing || config.wellbeing.length === 0}
              >
                Bienestar
              </button>
              <button
                onClick={() => setDetailView('saving')}
                className="px-3 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-sm"
                disabled={!config.saving || config.saving.length === 0}
              >
                Ahorro
              </button>
            </div>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${formatNumber(Number(v), 2)}%`} />
            <Legend />
            {detailView ? (
              // Mostrar cada categoría del bucket seleccionado
              (() => {
                const bucketCategories = config[detailView] || [];
                const colors = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#84cc16'];
                return bucketCategories.map((cat, index) => (
                  <Line
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    name={capitalizeWords(cat)}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                  />
                ));
              })()
            ) : (
              // Vista general: mostrar los 3 buckets
              <>
                <Line type="monotone" dataKey="fixed" name={t('fixedExpense') || 'Gasto fijo'} stroke="#60a5fa" strokeWidth={2} />
                <Line type="monotone" dataKey="wellbeing" name={t('wellbeing') || 'Bienestar'} stroke="#34d399" strokeWidth={2} />
                <Line type="monotone" dataKey="saving" name={t('saving') || 'Ahorro'} stroke="#f59e0b" strokeWidth={2} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
        {detailView ? (
          // Vista detallada: mostrar cada categoría del bucket
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-3">
              {detailView === 'fixed' ? (t('fixedExpense') || 'Gasto fijo') :
               detailView === 'wellbeing' ? (t('wellbeing') || 'Bienestar') :
               (t('saving') || 'Ahorro')} - Detalle por Categoría
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {(config[detailView] || []).map((cat, index) => {
                const colors = ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#84cc16'];
                const color = colors[index % colors.length];
                const catValue = current[cat] || 0;
                return (
                  <div key={cat} className="rounded-lg p-3 border-2" style={{ borderColor: color, backgroundColor: `${color}15` }}>
                    <div className="font-semibold" style={{ color }}>
                      {capitalizeWords(cat)}: <span style={{ color }}>{formatNumber(catValue, 2)}%</span>
                    </div>
                    <div className="text-[#616f89] dark:text-gray-400 text-xs mt-1">
                      Año {currentYear}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Vista general: mostrar los 3 buckets
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
              <div className="font-semibold">{t('fixedExpense') || 'Gasto fijo'}: <span className="text-blue-600 dark:text-blue-400">{formatNumber(current.fixed, 2)}%</span></div>
              <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.fixed > 0 ? '+' : ''}{formatNumber(deviation.fixed, 2)}%</div>
            </div>
            <div className="rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
              <div className="font-semibold">{t('wellbeing') || 'Bienestar'}: <span className="text-green-600 dark:text-green-400">{formatNumber(current.wellbeing, 2)}%</span></div>
              <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.wellbeing > 0 ? '+' : ''}{formatNumber(deviation.wellbeing, 2)}%</div>
            </div>
            <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
              <div className="font-semibold">{t('saving') || 'Ahorro'}: <span className="text-amber-600 dark:text-amber-400">{formatNumber(current.saving, 2)}%</span></div>
              <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.saving > 0 ? '+' : ''}{formatNumber(deviation.saving, 2)}%</div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


