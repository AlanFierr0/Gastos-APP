import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { formatNumber } from '../utils/format.js';

// Format Y-axis values with K (thousands) or M (millions)
const formatYAxisValue = (value) => {
  if (value >= 1000000) {
    return `${formatNumber(value / 1000000, 1)}M`;
  } else if (value >= 1000) {
    return `${formatNumber(value / 1000, 1)}K`;
  }
  return value.toString();
};

// Axis values without currency; we'll show ARS once via axis label

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const isDark = document.documentElement.classList.contains('dark');
    return (
      <div 
        className={`rounded-lg border p-2 shadow-lg z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
        style={isDark ? { backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(55 65 81)' } : {}}
      >
        {payload.map((entry, index) => {
          // Use absolute value for display - the chart position already shows direction
          // Expenses are negative (below zero) but should display as positive
          const absValue = Math.abs(entry.value || 0);
          const formatted = absValue.toLocaleString('es-AR', { 
            style: 'currency', 
            currency: 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          return (
            <p 
              key={index} 
              className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
              style={isDark ? { color: 'rgb(243 244 246)', backgroundColor: 'transparent' } : {}}
            >
              <span style={{ color: entry.color || (isDark ? 'rgb(243 244 246)' : '#000') }} className="category-name">{entry.name}: </span>
              {formatted}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export function LineSeries({ data, unitLabel = 'ARS' }) {
  return (
    <div className="relative">
      {unitLabel && (
        <div className="absolute top-2 right-3 text-[10px] text-gray-500 dark:text-gray-400 select-none pointer-events-none">{unitLabel}</div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={formatYAxisValue} />
          <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
          <Line type="monotone" dataKey="income" stroke="#135bec" strokeWidth={2} />
          <Line type="monotone" dataKey="expenses" stroke="#50E3C2" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PieBreakdown({ data, colors, onCategoryClick }) {
  // Generate a diverse color palette with variations using golden angle distribution
  const generateColorPalette = (count) => {
    if (colors && colors.length >= count) {
      return colors.slice(0, count);
    }
    
    // Extended default palette with diverse colors
    const defaultColors = [
      '#60a5fa', // Blue
      '#34d399', // Green
      '#f59e0b', // Orange
      '#a78bfa', // Purple
      '#ec4899', // Pink
      '#10b981', // Emerald
      '#f97316', // Orange-red
      '#3b82f6', // Bright Blue
      '#8b5cf6', // Violet
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#ef4444', // Red
      '#14b8a6', // Teal
      '#f43f5e', // Rose
      '#6366f1', // Indigo
      '#22c55e', // Green
      '#eab308', // Yellow
      '#a855f7', // Purple
      '#0ea5e9', // Sky Blue
      '#fb7185', // Rose
    ];
    
    // If we have enough default colors, use them
    if (count <= defaultColors.length) {
      return defaultColors.slice(0, count);
    }
    
    // For more colors, generate using golden angle distribution
    const palette = [...defaultColors];
    const goldenAngle = 137.508; // Golden angle for optimal color distribution
    
    for (let i = defaultColors.length; i < count; i++) {
      // Use golden angle to distribute hues evenly
      const hue = (i * goldenAngle) % 360;
      
      // Vary saturation and lightness to create visual variety
      const saturation = 55 + ((i * 7) % 35); // 55-90% with variation
      const lightness = 40 + ((i * 11) % 25); // 40-65% with variation
      
      palette.push(`hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`);
    }
    
    return palette;
  };
  
  // Sort data by value in descending order and filter invalid values
  const sortedData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    // Filter out invalid values (NaN, Infinity, negative, zero)
    const validData = data.filter(item => {
      const value = Number(item.value || 0);
      return !isNaN(value) && isFinite(value) && value > 0;
    });
    // Sort by value descending
    return [...validData].sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);
  
  // Generate palette based on data length
  const palette = React.useMemo(() => {
    return generateColorPalette(sortedData.length);
  }, [sortedData.length, colors]);
  
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const isDark = document.documentElement.classList.contains('dark');
      const entry = payload[0];
      const value = Number(entry.value || 0);
      
      // Calculate total to show percentage
      const total = sortedData.reduce((sum, item) => sum + Number(item.value || 0), 0);
      const percentage = total > 0 ? formatNumber((value / total) * 100, 1) : '0,0';
      
      return (
        <div 
          className={`rounded-lg border p-2 shadow-lg z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          style={isDark ? { backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(55 65 81)' } : {}}
        >
          <p 
            className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`}
            style={isDark ? { color: 'rgb(243 244 246)', backgroundColor: 'transparent' } : {}}
          >
            <span style={{ color: entry.payload.fill || (isDark ? 'rgb(243 244 246)' : '#000') }} className="category-name">{entry.name}: </span>
            {value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            <span className="ml-2 text-xs opacity-75">({percentage}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const handleCellClick = (data) => {
    if (onCategoryClick && data) {
      // Recharts passes the data entry directly
      const categoryName = data.name || (data.payload && data.payload.name);
      if (categoryName) {
        onCategoryClick(categoryName);
      }
    }
  };

  return (
    <div className={onCategoryClick ? 'clickable-chart' : undefined}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
        <Pie 
          data={sortedData} 
          dataKey="value" 
          nameKey="name" 
          innerRadius={60} 
          outerRadius={90}
          startAngle={90}
          endAngle={-270}
          cx="50%"
          cy="50%"
          onClick={handleCellClick}
        >
          {sortedData.map((entry, i) => (
              <Cell 
              key={i} 
              fill={palette[i % palette.length]} 
                
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarCompare({ data, showIncome = true, showExpenses = true, unitLabel = 'ARS', tickIncomeLabel = 'Income', tickExpenseLabel = 'Expense', tickRenderer = null, tooltipLabelFromDatum = false, customTooltip = null, onItemClick = null, onIncomeClick = null, onExpensesClick = null }) {
  const XTick = (props) => {
    const { x, y, payload } = props;
    const value = String(payload?.value || '');
    const isIncome = value.toLowerCase() === String(tickIncomeLabel).toLowerCase();
    const isExpense = value.toLowerCase() === String(tickExpenseLabel).toLowerCase();
    const color = isIncome ? '#22c55e' : (isExpense ? '#f59e0b' : '#9ca3af');
    return (
      <text x={x} y={y + 10} textAnchor="middle" fill={color} fontSize={12}>
        {value}
      </text>
    );
  };
  const isClickable = Boolean(onItemClick || onIncomeClick || onExpensesClick);
  return (
    <div className={`relative ${isClickable ? 'clickable-chart' : ''}`}>
      {unitLabel && (
        <div className="absolute top-2 right-3 text-[10px] text-gray-500 dark:text-gray-400 select-none pointer-events-none">{unitLabel}</div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }} onClick={onItemClick ? (e) => {
          if (!e) return;
          const label = e.activeLabel || (e?.activePayload && e.activePayload[0]?.payload?.name);
          if (label) onItemClick(label, e);
        } : undefined}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={tickRenderer ? tickRenderer : <XTick />} interval={0} />
          <YAxis tickFormatter={formatYAxisValue} />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            shared={false}
            content={customTooltip || (tooltipLabelFromDatum ? (
            ({ active, payload }) => {
              if (active && payload && payload.length) {
                const isDark = document.documentElement.classList.contains('dark');
                const p0 = payload[0];
                const label = p0 && p0.payload && p0.payload.name ? p0.payload.name : (p0?.name || '');
                const value = p0?.value || 0;
                const formatted = value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div className={`rounded-lg border p-2 shadow-lg z-50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} style={isDark ? { backgroundColor: 'rgb(31 41 55)', borderColor: 'rgb(55 65 81)' } : {}}>
                    <p className={`text-sm ${isDark ? 'text-gray-100' : 'text-gray-900'}`} style={isDark ? { color: 'rgb(243 244 246)', backgroundColor: 'transparent' } : {}}>
                      <span className="category-name" style={{ color: p0.color || (isDark ? 'rgb(243 244 246)' : '#000') }}>{label}: </span>{formatted}
                    </p>
                  </div>
                );
              }
              return null;
            }
          ) : <CustomTooltip />)} />
          {showIncome && (
            <Bar 
              dataKey="income" 
              fill="#22c55e" 
              radius={[6,6,0,0]} 
              onClick={onIncomeClick ? (_data, _index) => onIncomeClick(_data) : undefined}
              cursor={onIncomeClick ? 'pointer' : 'default'}
            />
          )}
          {showExpenses && (
            <Bar 
              dataKey="expenses" 
              fill="#f59e0b" 
              radius={[6,6,0,0]} 
              onClick={onExpensesClick ? (_data, _index) => onExpensesClick(_data) : undefined}
              cursor={onExpensesClick ? 'pointer' : 'default'}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}





