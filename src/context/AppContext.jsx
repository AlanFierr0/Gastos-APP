import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { translate } from '../i18n.js';
import * as api from '../api/index.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [categories, setCategories] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const locale = 'es'; // Always Spanish
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
        const [e, i, c, ex] = await Promise.allSettled([
          api.getExpenses(), 
          api.getIncome(), 
          api.getCategories(),
          api.getExchangeRates()
        ]);
        if (e.status === 'fulfilled') setExpenses(e.value);
        if (i.status === 'fulfilled') setIncome(i.value);
        if (c.status === 'fulfilled') setCategories(c.value);
        if (ex.status === 'fulfilled') setExchangeRates(ex.value);
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

  const categoryById = useCallback((id) => {
    return categories.find((x) => x.id === id);
  }, [categories]);

  const ensureCategory = useCallback(async (name, typeName) => {
    const lower = String(name || '').trim().toLowerCase();
    if (!lower) return null;
    const existing = categories.find((c) => String(c.name || '').toLowerCase() === lower);
    if (existing) return existing;
    const created = await api.createCategory({ name: lower, typeName });
    if (created && created.id) {
      setCategories((prev) => [created, ...prev]);
      return created;
    }
    return null;
  }, [categories]);

  const value = useMemo(() => ({
    expenses,
    income,
    categories,
    exchangeRates,
    setExpenses,
    setIncome,
    setCategories,
    setExchangeRates,
    loading,
    error,
    totals,
    api,
    locale,
    t: (key) => translate('es', key),
    theme,
    setTheme,
    toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    async addIncome(newIncome) {
      const concept = String(newIncome.concept || '').trim();
      const lowerCategoryName = String(newIncome.categoryName || '').trim().toLowerCase();
      let categoryId = newIncome.categoryId;
      if (!categoryId && lowerCategoryName) {
        const cat = await ensureCategory(lowerCategoryName, 'income');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newIncome,
        concept,
        categoryId,
        category: categoryId ? categoryById(categoryId) : (lowerCategoryName ? { id: undefined, name: lowerCategoryName } : undefined),
      };
      setIncome((prev) => [optimistic, ...prev]);
      try {
        const payload = {
          concept,
          amount: newIncome.amount,
          date: newIncome.date,
          note: newIncome.note,
          currency: newIncome.currency,
          categoryId,
          isRecurring: newIncome.isRecurring,
        };
        const saved = await api.createIncome(payload);
        if (saved && saved.id) {
          setIncome((prev) => [saved, ...prev.filter((i) => i.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async updateIncome(id, updates) {
      const concept = updates.concept !== undefined ? String(updates.concept || '').trim() : undefined;
      const lowerCategoryName = String(updates.categoryName || '').trim().toLowerCase();
      let categoryId = updates.categoryId;
      if (!categoryId && lowerCategoryName) {
        const cat = await ensureCategory(lowerCategoryName, 'income');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        ...updates,
        ...(concept !== undefined ? { concept } : {}),
        id,
        categoryId,
      };
      setIncome((prev) => prev.map((i) => (i.id === id ? { ...i, ...optimistic, category: categoryId ? categoryById(categoryId) : i.category } : i)));
      try {
        const payload = {
          ...(concept !== undefined ? { concept } : {}),
          ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
          ...(updates.date !== undefined ? { date: updates.date } : {}),
          ...(updates.note !== undefined ? { note: updates.note } : {}),
          ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(updates.isRecurring !== undefined ? { isRecurring: updates.isRecurring } : {}),
        };
        const saved = await api.updateIncome(id, payload);
        if (saved && saved.id) {
          setIncome((prev) => prev.map((i) => (i.id === id ? saved : i)));
        }
      } catch {}
    },
    async removeIncome(id) {
      setIncome((prev) => prev.filter((i) => i.id !== id));
      try { await api.deleteIncome(id); } catch {}
    },
    async addExpense(newExpense) {
      const lowerCategoryName = String(newExpense.categoryName || '').trim().toLowerCase();
      const concept = String(newExpense.concept || '').trim();
      let categoryId = newExpense.categoryId;
      if (!categoryId) {
        const cat = await ensureCategory(lowerCategoryName, 'expense');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newExpense,
        concept,
        categoryId,
        category: categoryId ? categoryById(categoryId) : { id: undefined, name: lowerCategoryName },
      };
      setExpenses((prev) => [optimistic, ...prev]);
      try {
        const payload = {
          concept,
          amount: newExpense.amount,
          date: newExpense.date,
          note: newExpense.note,
          currency: newExpense.currency,
          categoryId,
          expenseType: newExpense.expenseType,
        };
        const saved = await api.createExpense(payload);
        if (saved && saved.id) {
          setExpenses((prev) => [saved, ...prev.filter((e) => e.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async updateExpense(id, updates) {
      const lowerCategoryName = String(updates.categoryName || '').trim().toLowerCase();
      const concept = updates.concept !== undefined ? String(updates.concept || '').trim() : undefined;
      let categoryId = updates.categoryId;
      if (!categoryId && lowerCategoryName) {
        const cat = await ensureCategory(lowerCategoryName, 'expense');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        ...updates,
        ...(concept !== undefined ? { concept } : {}),
        id,
        categoryId,
      };
      // Asegurarse de que la nota se mantenga en el estado optimístico
      setExpenses((prev) => prev.map((e) => {
        if (e.id === id) {
          const updated = { ...e, ...optimistic, category: categoryId ? categoryById(categoryId) : e.category };
          // Si se está actualizando la nota, asegurarse de que se mantenga
          if (updates.note !== undefined) {
            updated.note = updates.note;
          }
          return updated;
        }
        return e;
      }));
      try {
        const payload = {
          ...(concept !== undefined ? { concept } : {}),
          ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
          ...(updates.date !== undefined ? { date: updates.date } : {}),
          ...(updates.note !== undefined ? { note: updates.note } : {}),
          ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
        };
        const saved = await api.updateExpense(id, payload);
        if (saved && saved.id) {
          setExpenses((prev) => prev.map((e) => (e.id === id ? saved : e)));
        }
      } catch {}
    },
    async removeExpense(id) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      try { await api.deleteExpense(id); } catch {}
    },
    async refreshExpenses() {
      try {
        const data = await api.getExpenses();
        setExpenses(data || []);
      } catch {}
    },
    async refreshIncome() {
      try {
        const data = await api.getIncome();
        setIncome(data || []);
      } catch {}
    },
    async refreshExchangeRates() {
      try {
        const data = await api.getExchangeRates();
        setExchangeRates(data || []);
      } catch {}
    },
  }), [
    expenses,
    income,
    categories,
    exchangeRates,
    loading,
    error,
    totals,
    locale,
    theme,
    setExpenses,
    setIncome,
    setCategories,
    setExchangeRates,
    setTheme,
    categoryById,
    ensureCategory,
  ]);

  // Ensure value is always an object
  const contextValue = value || {
    expenses: [],
    income: [],
    categories: [],
    exchangeRates: [],
    setExpenses: () => {},
    setIncome: () => {},
    setCategories: () => {},
    setExchangeRates: () => {},
    loading: false,
    error: null,
    totals: { totalExpenses: 0, totalIncome: 0, balance: 0 },
    api,
    locale: 'es',
    t: (key) => translate('es', key),
    theme: 'light',
    setTheme: () => {},
    toggleTheme: () => {},
  };

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}


