import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ value, onChange, options = [], className = '', buttonClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Calculate position when opening
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });

      const handleClickOutside = (event) => {
        const dropdown = document.querySelector('[data-custom-select-dropdown]');
        const clickedOnButton = buttonRef.current && buttonRef.current.contains(event.target);
        const clickedOnDropdown = dropdown && dropdown.contains(event.target);
        
        if (!clickedOnButton && !clickedOnDropdown) {
          setIsOpen(false);
        }
      };

      // Use a small delay to avoid closing immediately when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0];

  const handleSelect = (optionValue, e) => {
    e?.stopPropagation();
    onChange && onChange(optionValue);
    setIsOpen(false);
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        className={`h-9 px-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm border-2 border-primary focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between gap-2 min-w-[120px] ${buttonClassName}`}
      >
        <span>{selectedOption?.label || ''}</span>
        <span className="material-symbols-outlined text-sm" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          expand_more
        </span>
      </button>
      
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          data-custom-select-dropdown="true"
          className="fixed z-[99999] bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shadow-lg p-1"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width || 120}px`,
            minWidth: '120px'
          }}
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={(e) => handleSelect(opt.value, e)}
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
        </div>,
        document.body
      )}
    </div>
  );
}

