import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Navbar() {
  const { t, locale, setLocale, theme, toggleTheme } = useApp();
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200 dark:bg-background-dark/70 dark:border-gray-800">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/spreadsheet" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 text-primary">
            <svg viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 6H42L36 24L42 42H6L12 24L6 6Z"/></svg>
          </div>
          <span className="font-bold">{t('appName')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium"
            aria-label={t('toggleTheme')}
            title={t('toggleTheme')}
          >
            <span className="material-symbols-outlined text-gray-700 dark:text-gray-200 align-middle">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            className="h-9 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium"
            aria-label="Toggle language"
          >
            {locale === 'es' ? 'ES' : 'EN'}
          </button>
        </div>
      </div>
    </header>
  );
}


