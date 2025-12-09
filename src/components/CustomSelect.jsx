import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ value, onChange, options = [], className = '', buttonClassName = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      // Function to update dropdown position
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom + 4, // Use viewport-relative position (no scrollY)
            left: rect.left, // Use viewport-relative position (no scrollX)
            width: rect.width
          });
        }
      };

      // Calculate position when opening
      updatePosition();

      const handleClickOutside = (event) => {
        // Buscar el dropdown usando el atributo data
        const dropdown = document.querySelector('[data-custom-select-dropdown]');
        
        // Verificar si el click fue en el botón o en el contenedor del select
        const clickedOnSelect = selectRef.current && selectRef.current.contains(event.target);
        const clickedOnButton = buttonRef.current && buttonRef.current.contains(event.target);
        const clickedOnDropdown = dropdown && dropdown.contains(event.target);
        
        // Si se hace click en cualquier parte del select (botón, contenedor o dropdown), no cerrar
        if (clickedOnSelect || clickedOnButton || clickedOnDropdown) {
          return;
        }
        
        // Solo cerrar si se hace click completamente fuera
        setIsOpen(false);
      };

      // Update position on scroll to keep dropdown aligned with button
      const handleScroll = () => {
        updatePosition();
      };

      // Usar capture phase para capturar eventos antes de que se propaguen
      // Reducir delay para evitar que clicks se propaguen antes de que los listeners estén activos
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, true); // Capture phase
        document.addEventListener('click', handleClickOutside, true); // Capture phase
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', updatePosition);
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('click', handleClickOutside, true);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => {
    const optValue = opt.value === null || opt.value === undefined ? '' : String(opt.value);
    const currentValue = value === null || value === undefined ? '' : String(value);
    return optValue === currentValue;
  }) || options[0];

  const handleSelect = (optionValue, e) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    // Cerrar el dropdown antes de llamar onChange para evitar conflictos
    setIsOpen(false);
    
    // Usar setTimeout para asegurar que el estado se actualice antes de llamar onChange
    // Aumentar el delay para evitar que el click se propague y cierre modales
    setTimeout(() => {
      if (onChange) {
        onChange(optionValue);
      }
    }, 50);
  };

  const handleButtonClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Prevenir que el evento se propague hacia arriba en el árbol DOM
    e.nativeEvent.stopImmediatePropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div 
      className={`relative ${className}`} 
      ref={selectRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
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
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
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

