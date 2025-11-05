import React from 'react';

export default function Select({ value, onChange, options = [], className = '', buttonClassName = '', menuClassName = '' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value)) || options[0];

  function handleSelect(v) {
    if (onChange) onChange(v);
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`h-9 px-3 pr-8 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm flex items-center gap-2 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary ${buttonClassName}`}
      >
        <span className="truncate">{selected ? selected.label : ''}</span>
        <span className="material-symbols-outlined text-base ml-auto">expand_more</span>
      </button>
      {open && (
        <div
          className={`absolute z-50 mt-2 w-full min-w-[12rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden ${menuClassName}`}
        >
          <ul className="max-h-64 overflow-auto py-1">
            {options.map((opt) => (
              <li key={String(opt.value)}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    String(opt.value) === String(value) ? 'bg-primary/10 text-primary' : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


