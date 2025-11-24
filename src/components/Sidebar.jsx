import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '../context/AppContext.jsx';
import Logo from './Logo.jsx';

const linkClass = ({ isActive }, isMinimized) =>
  clsx(
    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
    isActive
      ? 'bg-primary/20 text-primary dark:bg-primary/20'
      : 'text-[#616f89] hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    isMinimized && 'justify-center'
  );

export default function Sidebar() {
  const { t, theme, toggleTheme } = useApp();
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <aside className={`${isMinimized ? 'w-20' : 'w-64'} shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-background-dark sticky top-0 h-screen overflow-y-auto transition-all duration-300 flex flex-col`}>
      <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        {!isMinimized && <Logo showLink={false} />}
        {isMinimized && (
          <div className="flex justify-center w-full">
            <img src="/logo.png" alt="Spendo" className="h-12 w-12 object-contain" />
          </div>
        )}
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          title={isMinimized ? 'Expandir' : 'Minimizar'}
        >
          <span className="material-symbols-outlined text-xl">
            {isMinimized ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>
      <nav className="flex flex-col gap-2 p-4">
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/dashboard" title={isMinimized ? t('dashboard') : ''}>
          <span className="material-symbols-outlined">dashboard</span>
          {!isMinimized && <span className="text-sm font-medium">{t('dashboard')}</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/grid" title={isMinimized ? (t('grid') || 'Grilla') : ''}>
          <span className="material-symbols-outlined">grid_on</span>
          {!isMinimized && <span className="text-sm font-medium">{t('grid') || 'Grilla'}</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/spreadsheet" title={isMinimized ? t('spreadsheet') : ''}>
          <span className="material-symbols-outlined">table_chart</span>
          {!isMinimized && <span className="text-sm font-medium">{t('spreadsheet')}</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/analysis" title={isMinimized ? (t('financialAnalysis') || 'Análisis') : ''}>
          <span className="material-symbols-outlined">monitoring</span>
          {!isMinimized && <span className="text-sm font-medium">{t('financialAnalysis') || 'Análisis'}</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/investment" title={isMinimized ? 'Inversiones' : ''}>
          <span className="material-symbols-outlined">trending_up</span>
          {!isMinimized && <span className="text-sm font-medium">Inversiones</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/investment-history" title={isMinimized ? 'Historial de Inversiones' : ''}>
          <span className="material-symbols-outlined">history</span>
          {!isMinimized && <span className="text-sm font-medium">Historial de Inversiones</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/holdings" title={isMinimized ? 'Tenencias' : ''}>
          <span className="material-symbols-outlined">people</span>
          {!isMinimized && <span className="text-sm font-medium">Tenencias</span>}
        </NavLink>
        <NavLink className={(props) => linkClass(props, isMinimized)} to="/upload" title={isMinimized ? t('upload') : ''}>
          <span className="material-symbols-outlined">file_upload</span>
          {!isMinimized && <span className="text-sm font-medium">{t('upload')}</span>}
        </NavLink>
      </nav>
      <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800 flex justify-center">
        <button
          onClick={toggleTheme}
          className="relative inline-flex items-center h-8 w-20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 px-1"
          style={{
            backgroundColor: theme === 'dark' ? '#4B5563' : '#E5E7EB'
          }}
          title={t('toggleTheme')}
          aria-label={t('toggleTheme')}
        >
          <span className="material-symbols-outlined text-sm absolute left-1.5" style={{ color: theme === 'dark' ? '#9CA3AF' : '#F59E0B' }}>
            light_mode
          </span>
          <span
            className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform flex items-center justify-center z-10"
            style={{
              transform: theme === 'dark' ? 'translateX(48px)' : 'translateX(0px)'
            }}
          >
          </span>
          <span className="material-symbols-outlined text-sm absolute right-1.5" style={{ color: theme === 'dark' ? '#E5E7EB' : '#9CA3AF' }}>
            dark_mode
          </span>
        </button>
      </div>
    </aside>
  );
}


