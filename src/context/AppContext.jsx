import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { translate } from '../i18n.js';
import * as api from '../api/index.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [persons, setPersons] = useState([]);
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

  useEffect(() => {
    // Preload minimal data from backend (if available)
    (async () => {
      try {
        setLoading(true);
        const [e, i, p] = await Promise.allSettled([api.getExpenses(), api.getIncome(), api.getPersons()]);
        if (e.status === 'fulfilled') setExpenses(e.value);
        if (i.status === 'fulfilled') setIncome(i.value);
        if (p.status === 'fulfilled') setPersons(p.value);
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

  const totals = useMemo(() => {
    const totalExpenses = expenses.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const totalIncome = income.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    return {
      totalExpenses,
      totalIncome,
      balance: totalIncome - totalExpenses,
    };
  }, [expenses, income]);

  function personNameById(id) {
    const p = persons.find((x) => x.id === id);
    return p ? p.name : '';
  }

  const value = {
    expenses,
    income,
    persons,
    setExpenses,
    setIncome,
    setPersons,
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
    async addPerson(name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      // optimistic add
      const optimistic = { id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2), name: trimmed };
      setPersons((prev) => [...prev, optimistic]);
      try {
        const saved = await api.createPerson({ name: trimmed });
        if (saved && saved.id) {
          setPersons((prev) => [saved, ...prev.filter((p) => p.id !== optimistic.id)]);
        }
      } catch {}
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
        person: personNameById(newIncome.personId) || newIncome.person,
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
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newExpense,
        person: personNameById(newExpense.personId) || newExpense.person,
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


