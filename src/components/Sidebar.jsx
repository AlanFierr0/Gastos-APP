import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '../context/AppContext.jsx';

const linkClass = ({ isActive }) =>
  clsx(
    'flex items-center gap-3 px-3 py-2 rounded-lg',
    isActive
      ? 'bg-primary/10 text-primary dark:bg-primary/20'
      : 'text-[#616f89] hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
  );

export default function Sidebar() {
  const { t } = useApp();
  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-background-dark sticky top-0 h-screen overflow-y-auto">
      <nav className="flex flex-col gap-2 p-4">
        <NavLink className={linkClass} to="/spreadsheet">
          <span className="material-symbols-outlined">table_chart</span>
          <span className="text-sm font-medium">{t('spreadsheet')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/dashboard">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-sm font-medium">{t('dashboard')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/expenses">
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="text-sm font-medium">{t('expenses')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/income">
          <span className="material-symbols-outlined">account_balance_wallet</span>
          <span className="text-sm font-medium">{t('income')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/people">
          <span className="material-symbols-outlined">group</span>
          <span className="text-sm font-medium">{t('people')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/investments">
          <span className="material-symbols-outlined">trending_up</span>
          <span className="text-sm font-medium">{t('investments')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/upload">
          <span className="material-symbols-outlined">file_upload</span>
          <span className="text-sm font-medium">{t('upload')}</span>
        </NavLink>
      </nav>
    </aside>
  );
}


