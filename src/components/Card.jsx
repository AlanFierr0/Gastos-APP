import React from 'react';

export default function Card({ title, children, footer }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700/50 dark:bg-[#1a1f2e] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
      {title && <p className="text-sm font-medium text-[#616f89] dark:text-gray-300 mb-1">{title}</p>}
      <div className="dark:text-gray-100">{children}</div>
      {footer && <div className="mt-3 text-sm text-[#616f89] dark:text-gray-300">{footer}</div>}
    </div>
  );
}





