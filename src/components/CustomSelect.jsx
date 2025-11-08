import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ value, onChange, options = [], className = '', buttonClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0];

  const handleSelect = (optionValue) => {
    onChange && onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-9 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm border-2 border-primary focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between gap-2 min-w-[120px] ${buttonClassName}`}
      >
        <span>{selectedOption?.label || ''}</span>
        <span className="material-symbols-outlined text-sm" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          expand_more
        </span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shadow-lg min-w-[120px] p-1">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-sm text-center rounded-xl transition-all ${
                  isSelected
                    ? 'bg-primary text-white border-2 border-primary font-medium'
                    : 'bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-transparent hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

