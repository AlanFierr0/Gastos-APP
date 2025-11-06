import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import Card from '../components/Card.jsx';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import * as api from '../api/index.js';

function useFAConfig(categories) {
  const [config, setConfig] = React.useState({
    fixed: [],
    wellbeing: [],
    saving: [],
    targets: { fixed: 50, wellbeing: 30, saving: 20 },
  });
  const [loading, setLoading] = React.useState(true);

  // Load config from API on mount
  React.useEffect(() => {
    (async () => {
      try {
        const data = await api.getFAConfig();
        setConfig(data);
      } catch (err) {
        console.error('Error loading FA config:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = React.useCallback(async (next) => {
    setConfig(next);
    try {
      // Transform to API format
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
  }, []);

  const toggle = (bucket, categoryName) => {
    const lower = String(categoryName || '').toLowerCase();
    const current = new Set(config[bucket] || []);
    if (current.has(lower)) current.delete(lower); else current.add(lower);
    const next = { ...config, [bucket]: Array.from(current) };
    save(next);
  };

  const setTarget = (bucket, value) => {
    const num = Number(value || 0);
    // Round to 2 decimal places and clamp between 0-100
    const v = Math.max(0, Math.min(100, Math.round(num * 100) / 100));
    save({ ...config, targets: { ...config.targets, [bucket]: v } });
  };

  const formatTargetValue = (value) => {
    const num = Number(value || 0);
    // Show as integer if it's a whole number, otherwise 2 decimals
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const allCategoryNames = React.useMemo(() => {
    return (categories || []).map(c => String(c.name || '').toLowerCase());
  }, [categories]);

  // Ensure config only keeps categories that exist (guard against renames)
  React.useEffect(() => {
    if (loading) return; // Don't save while loading
    const cleanse = (list) => Array.from(new Set(list)).filter(n => allCategoryNames.includes(n));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategoryNames.join('|'), loading]);

  return { config, toggle, setTarget, formatTargetValue, loading };
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

function buildYearlyPercents(expenses, config) {
  // Build totals per year
  const yearTotals = new Map();
  const yearBucket = new Map(); // year -> {fixed, wellbeing, saving}

  for (const e of (expenses || [])) {
    const d = new Date(e.date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // getUTCMonth() returns 0-11
    
    // Exclude forecast months
    if (isForecastMonth(year, month)) continue;
    
    const amount = Number(e.amount || 0);
    const cat = (typeof e.category === 'object' && e.category) ? (e.category.name || '') : (e.category || '');
    const lowerCat = String(cat).toLowerCase();

    yearTotals.set(year, (yearTotals.get(year) || 0) + amount);
    const buckets = yearBucket.get(year) || { fixed: 0, wellbeing: 0, saving: 0 };
    if (config.fixed.includes(lowerCat)) buckets.fixed += amount;
    if (config.wellbeing.includes(lowerCat)) buckets.wellbeing += amount;
    if (config.saving.includes(lowerCat)) buckets.saving += amount;
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
      fixed: Number(safePct(b.fixed).toFixed(2)),
      wellbeing: Number(safePct(b.wellbeing).toFixed(2)),
      saving: Number(safePct(b.saving).toFixed(2)),
    };
  });
}

export default function FinancialAnalysis() {
  const { expenses, categories, t } = useApp();
  const { config, toggle, setTarget, formatTargetValue, loading } = useFAConfig(categories);
  const [editingTarget, setEditingTarget] = React.useState({ bucket: null, value: '' });
  const [collapsed, setCollapsed] = React.useState({ fixed: false, wellbeing: false, saving: false });
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

  const series = React.useMemo(() => buildYearlyPercents(expenses, config), [expenses, config]);
  const currentYear = new Date().getFullYear();
  const current = series.find(s => Number(s.year) === currentYear) || { fixed: 0, wellbeing: 0, saving: 0 };
  const deviation = {
    fixed: Number((current.fixed - (config.targets.fixed || 0)).toFixed(2)),
    wellbeing: Number((current.wellbeing - (config.targets.wellbeing || 0)).toFixed(2)),
    saving: Number((current.saving - (config.targets.saving || 0)).toFixed(2)),
  };

  const catList = (bucket) => {
    // Get all categories selected in other buckets
    const otherBuckets = ['fixed', 'wellbeing', 'saving'].filter(b => b !== bucket);
    const selectedInOthers = new Set();
    otherBuckets.forEach(b => {
      (config[b] || []).forEach(cat => selectedInOthers.add(cat));
    });

    // Filter categories: show only if not selected in other buckets, or already selected in current bucket
    return (categories || [])
      .filter((c) => {
        const lower = String(c.name || '').toLowerCase();
        const isInCurrent = (config[bucket] || []).includes(lower);
        const isInOthers = selectedInOthers.has(lower);
        // Show if it's in current bucket OR not in any other bucket
        return isInCurrent || !isInOthers;
      })
      .map((c) => {
        const lower = String(c.name || '').toLowerCase();
        const checked = (config[bucket] || []).includes(lower);
        return (
          <label key={`${bucket}-${lower}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" checked={checked} onChange={() => toggle(bucket, lower)} />
            <span className="text-sm">{c.name}</span>
          </label>
        );
      });
  };

  const bucketSummary = (bucket) => {
    const sel = (config[bucket] || []);
    const shown = sel.slice(0, 5).join(', ');
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
            <h3 
              className={`font-semibold mb-2 ${collapsed.fixed ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={collapsed.fixed ? () => setCollapsed((s) => ({ ...s, fixed: false })) : undefined}
            >
              {t('fixedExpense') || 'Gasto fijo'}
            </h3>
            {!collapsed.fixed ? (
              <div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700">
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
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => setCollapsed((s) => ({ ...s, fixed: true }))}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
          <div>
            <h3 
              className={`font-semibold mb-2 ${collapsed.wellbeing ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={collapsed.wellbeing ? () => setCollapsed((s) => ({ ...s, wellbeing: false })) : undefined}
            >
              {t('wellbeing') || 'Bienestar'}
            </h3>
            {!collapsed.wellbeing ? (
              <div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700">
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
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => setCollapsed((s) => ({ ...s, wellbeing: true }))}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
          <div>
            <h3 
              className={`font-semibold mb-2 ${collapsed.saving ? 'cursor-pointer hover:text-primary' : ''}`}
              onClick={collapsed.saving ? () => setCollapsed((s) => ({ ...s, saving: false })) : undefined}
            >
              {t('saving') || 'Ahorro'}
            </h3>
            {!collapsed.saving ? (
              <div className="max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700">
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
                  <button type="button" className="h-8 px-3 rounded bg-primary text-white text-xs" onClick={() => setCollapsed((s) => ({ ...s, saving: true }))}>{t('confirm') || 'Confirmar'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title={(t('yearlyBreakdown') || 'Desglose anual') + ' (%)'}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
            <Legend />
            <Line type="monotone" dataKey="fixed" name={t('fixedExpense') || 'Gasto fijo'} stroke="#60a5fa" strokeWidth={2} />
            <Line type="monotone" dataKey="wellbeing" name={t('wellbeing') || 'Bienestar'} stroke="#34d399" strokeWidth={2} />
            <Line type="monotone" dataKey="saving" name={t('saving') || 'Ahorro'} stroke="#f59e0b" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
            <div className="font-semibold">{t('fixedExpense') || 'Gasto fijo'}: <span className="text-blue-600 dark:text-blue-400">{current.fixed.toFixed(2)}%</span></div>
            <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.fixed > 0 ? '+' : ''}{deviation.fixed}%</div>
          </div>
          <div className="rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
            <div className="font-semibold">{t('wellbeing') || 'Bienestar'}: <span className="text-green-600 dark:text-green-400">{current.wellbeing.toFixed(2)}%</span></div>
            <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.wellbeing > 0 ? '+' : ''}{deviation.wellbeing}%</div>
          </div>
          <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
            <div className="font-semibold">{t('saving') || 'Ahorro'}: <span className="text-amber-600 dark:text-amber-400">{current.saving.toFixed(2)}%</span></div>
            <div className="text-[#616f89] dark:text-gray-400">{t('currentYearDeviation') || 'Desvío año actual'}: {deviation.saving > 0 ? '+' : ''}{deviation.saving}%</div>
          </div>
        </div>
      </Card>
    </div>
  );
}


