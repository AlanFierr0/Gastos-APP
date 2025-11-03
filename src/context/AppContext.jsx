import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { translate } from '../i18n.js';
import * as api from '../api/index.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locale, setLocale] = useState('es');
  const [theme, setTheme] = useState(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
    if (stored === 'dark' || stored === 'light') return stored;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [persons, setPersons] = useState(() => {
    try {
      const raw = window.localStorage.getItem('persons');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Preload minimal data from backend (if available)
    (async () => {
      try {
        setLoading(true);
        const [e, i] = await Promise.allSettled([api.getExpenses(), api.getIncome()]);
        if (e.status === 'fulfilled') setExpenses(e.value);
        if (i.status === 'fulfilled') setIncome(i.value);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('persons', JSON.stringify(persons));
    } catch {}
  }, [persons]);

  const totals = useMemo(() => {
    const totalExpenses = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const totalIncome = income.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    return {
      totalExpenses,
      totalIncome,
      balance: totalIncome - totalExpenses,
    };
  }, [expenses, income]);

  const value = {
    expenses,
    income,
    setExpenses,
    setIncome,
    loading,
    error,
    totals,
    api,
    locale,
    setLocale,
    t: (key) => translate(locale, key),
    theme,
    setTheme,
    toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    persons,
    addPerson(name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      const exists = persons.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) return;
      const newPerson = { id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2), name: trimmed };
      setPersons((prev) => [...prev, newPerson]);
    },
    updatePerson(id, name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    },
    removePerson(id) {
      setPersons((prev) => prev.filter((p) => p.id !== id));
    },
    async addIncome(newIncome) {
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newIncome,
      };
      setIncome((prev) => [optimistic, ...prev]);
      try {
        const saved = await api.createIncome(newIncome);
        if (saved && saved.id) {
          setIncome((prev) => [saved, ...prev.filter((i) => i.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async addExpense(newExpense) {
      // optimistic create; will use backend if disponible
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newExpense,
      };
      setExpenses((prev) => [optimistic, ...prev]);
      try {
        const saved = await api.createExpense(newExpense);
        if (saved && saved.id) {
          setExpenses((prev) => [saved, ...prev.filter((e) => e.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}


