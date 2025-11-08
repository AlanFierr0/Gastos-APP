import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '../context/AppContext.jsx';
import Logo from './Logo.jsx';

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
      <div className="p-2 border-b border-gray-200 dark:border-gray-800 bg-background-dark">
        <Logo />
      </div>
      <nav className="flex flex-col gap-2 p-4">
        <NavLink className={linkClass} to="/dashboard">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-sm font-medium">{t('dashboard')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/grid">
          <span className="material-symbols-outlined">grid_on</span>
          <span className="text-sm font-medium">{t('grid') || 'Grilla'}</span>
        </NavLink>
        <NavLink className={linkClass} to="/spreadsheet">
          <span className="material-symbols-outlined">table_chart</span>
          <span className="text-sm font-medium">{t('spreadsheet')}</span>
        </NavLink>
        <NavLink className={linkClass} to="/analysis">
          <span className="material-symbols-outlined">monitoring</span>
          <span className="text-sm font-medium">{t('financialAnalysis') || 'Análisis'}</span>
        </NavLink>
        <NavLink className={linkClass} to="/upload">
          <span className="material-symbols-outlined">file_upload</span>
          <span className="text-sm font-medium">{t('upload')}</span>
        </NavLink>
      </nav>
    </aside>
  );
}


