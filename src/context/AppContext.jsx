import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { translate } from '../i18n.js';
import * as api from '../api/index.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState(null);
  const [persons, setPersons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
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
        const [e, i, inv, invSum, p, c, ex] = await Promise.allSettled([
          api.getExpenses(), 
          api.getIncome(), 
          api.getInvestments(),
          api.getInvestmentSummary(),
          api.getPersons(), 
          api.getCategories(),
          api.getExchangeRates()
        ]);
        if (e.status === 'fulfilled') setExpenses(e.value);
        if (i.status === 'fulfilled') setIncome(i.value);
        if (inv.status === 'fulfilled') setInvestments(inv.value);
        if (invSum.status === 'fulfilled') setInvestmentSummary(invSum.value);
        if (p.status === 'fulfilled') setPersons(p.value);
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

  function personNameById(id) {
    const p = persons.find((x) => x.id === id);
    return p ? p.name : '';
  }

  function categoryById(id) {
    return categories.find((x) => x.id === id);
  }

  async function ensureCategory(name, typeName) {
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
  }

  const value = {
    expenses,
    income,
    investments,
    investmentSummary,
    persons,
    categories,
    exchangeRates,
    setExpenses,
    setIncome,
    setInvestments,
    setInvestmentSummary,
    setPersons,
    setCategories,
    setExchangeRates,
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
    async updatePerson(id, name, icon, color) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      const optimistic = { name: trimmed, icon: icon || undefined, color: color || undefined };
      setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, ...optimistic } : p)));
      try {
        const saved = await api.updatePerson(id, { name: trimmed, icon: icon || undefined, color: color || undefined });
        if (saved && saved.id) {
          setPersons((prev) => prev.map((p) => (p.id === id ? saved : p)));
        }
      } catch {}
    },
    removePerson(id) {
      setPersons((prev) => prev.filter((p) => p.id !== id));
    },
    async addIncome(newIncome) {
      const lowerSource = String(newIncome.source || '').trim().toLowerCase();
      let categoryId = newIncome.categoryId;
      if (!categoryId) {
        const cat = await ensureCategory(lowerSource, 'income');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newIncome,
        source: lowerSource,
        categoryId,
        category: categoryId ? categoryById(categoryId) : { id: undefined, name: lowerSource },
        person: personNameById(newIncome.personId) || newIncome.person,
      };
      setIncome((prev) => [optimistic, ...prev]);
      try {
        const saved = await api.createIncome({ ...newIncome, source: lowerSource, categoryId });
        if (saved && saved.id) {
          setIncome((prev) => [saved, ...prev.filter((i) => i.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async updateIncome(id, updates) {
      const lowerSource = String(updates.source || '').trim().toLowerCase();
      let categoryId = updates.categoryId;
      if (!categoryId && lowerSource) {
        const cat = await ensureCategory(lowerSource, 'income');
        categoryId = cat?.id || undefined;
      }
      const optimistic = { ...updates, id, source: lowerSource, categoryId };
      setIncome((prev) => prev.map((i) => (i.id === id ? { ...i, ...optimistic, category: categoryId ? categoryById(categoryId) : i.category } : i)));
      try {
        const saved = await api.updateIncome(id, { ...updates, source: lowerSource, categoryId });
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
      let categoryId = newExpense.categoryId;
      if (!categoryId) {
        const cat = await ensureCategory(lowerCategoryName, 'expense');
        categoryId = cat?.id || undefined;
      }
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newExpense,
        categoryId,
        category: categoryId ? categoryById(categoryId) : { id: undefined, name: lowerCategoryName },
        person: personNameById(newExpense.personId) || newExpense.person,
      };
      setExpenses((prev) => [optimistic, ...prev]);
      try {
        const saved = await api.createExpense({ ...newExpense, categoryId });
        if (saved && saved.id) {
          setExpenses((prev) => [saved, ...prev.filter((e) => e.id !== optimistic.id)]);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async updateExpense(id, updates) {
      const lowerCategoryName = String(updates.categoryName || '').trim().toLowerCase();
      let categoryId = updates.categoryId;
      if (!categoryId && lowerCategoryName) {
        const cat = await ensureCategory(lowerCategoryName, 'expense');
        categoryId = cat?.id || undefined;
      }
      const optimistic = { ...updates, id, categoryId };
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...optimistic, category: categoryId ? categoryById(categoryId) : e.category } : e)));
      try {
        const saved = await api.updateExpense(id, { ...updates, categoryId });
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
    async refreshPersons() {
      try {
        const data = await api.getPersons();
        setPersons(data || []);
      } catch {}
    },
    async refreshExchangeRates() {
      try {
        const data = await api.getExchangeRates();
        setExchangeRates(data || []);
      } catch {}
    },
    async addInvestment(newInvestment) {
      const optimistic = {
        id: crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
        ...newInvestment,
        person: personNameById(newInvestment.personId) || newInvestment.person,
      };
      setInvestments((prev) => [optimistic, ...prev]);
      try {
        const saved = await api.createInvestment(newInvestment);
        if (saved && saved.id) {
          setInvestments((prev) => [saved, ...prev.filter((inv) => inv.id !== optimistic.id)]);
          // Refresh summary
          const summary = await api.getInvestmentSummary();
          setInvestmentSummary(summary);
        }
      } catch {
        // keep optimistic if backend not available
      }
    },
    async updateInvestment(id, updates) {
      const optimistic = { ...updates, id };
      setInvestments((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...optimistic, person: personNameById(updates.personId) || inv.person } : inv)));
      try {
        const saved = await api.updateInvestment(id, updates);
        if (saved && saved.id) {
          setInvestments((prev) => prev.map((inv) => (inv.id === id ? saved : inv)));
          // Refresh summary
          const summary = await api.getInvestmentSummary();
          setInvestmentSummary(summary);
        }
      } catch {}
    },
    async removeInvestment(id) {
      setInvestments((prev) => prev.filter((inv) => inv.id !== id));
      try { 
        await api.deleteInvestment(id);
        // Refresh summary
        const summary = await api.getInvestmentSummary();
        setInvestmentSummary(summary);
      } catch {}
    },
    async refreshInvestments() {
      try {
        const [data, summary] = await Promise.all([
          api.getInvestments(),
          api.getInvestmentSummary(),
        ]);
        setInvestments(data || []);
        setInvestmentSummary(summary);
      } catch {}
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}


