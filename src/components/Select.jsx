import React from 'react';

export default function Select({ value, onChange, options = [], className = '', buttonClassName = '' }) {
  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`h-9 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm border-2 border-primary focus:outline-none focus:ring-2 focus:ring-primary ${buttonClassName}`}
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}


