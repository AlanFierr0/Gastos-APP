import React from 'react';

export default function Table({ columns, rows, onEdit, onDelete }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
      <table className="min-w-full">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {c.header}
              </th>
            ))}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">{row[c.key]}</td>
              ))}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => onEdit?.(row)} className="text-gray-400 hover:text-primary dark:hover:text-primary">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button onClick={() => onDelete?.(row)} className="text-gray-400 hover:text-red-500">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}





