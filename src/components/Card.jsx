import React from 'react';

export default function Card({ title, children, footer }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
      {title && <p className="text-sm font-medium text-[#616f89] dark:text-gray-400 mb-1">{title}</p>}
      <div>{children}</div>
      {footer && <div className="mt-3 text-sm text-[#616f89] dark:text-gray-400">{footer}</div>}
    </div>
  );
}





