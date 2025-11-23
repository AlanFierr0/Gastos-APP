// Simple API layer for a NestJS backend
// Adjust BASE_URL to match your server
import axios from 'axios';

const BASE_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:6543';
const http = axios.create({ baseURL: BASE_URL, timeout: 60000 }); // 60 seconds for large requests

export async function getExpenses(params) {
  try {
    const { data } = await http.get('/expenses', { params });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getIncome(params) {
  try {
    const { data } = await http.get('/income', { params });
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getCategories() {
  try {
    const { data } = await http.get('/categories');
    return data ?? [];
  } catch {
    return [];
  }
}

export async function createCategory(payload) {
  const { data } = await http.post('/categories', payload);
  return data;
}

export async function uploadExcel(formData) {
  const { data } = await http.post('/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function previewExcel(formData) {
  const { data } = await http.post('/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function confirmImport(records, expenseTypeMap = {}) {
  const { data } = await http.post('/upload/confirm', { records, expenseTypeMap });
  return data;
}

export async function loadMonthlySummary(summary, file) {
  if (file) {
    // Si hay archivo, enviarlo como FormData
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await http.post('/upload/monthly-summary', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  } else {
    // Si no hay archivo, enviar texto en el body
    const { data } = await http.post('/upload/monthly-summary', { summary });
    return data;
  }
}

export async function getMonthlySummarySections(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post('/upload/monthly-summary/sections', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function processMonthlySummarySection(sectionContent, sectionTitle) {
  try {
    const { data } = await http.post('/upload/monthly-summary/process-section', {
      sectionContent,
      sectionTitle,
    });
    return data;
  } catch (error) {
    // Re-lanzar el error para que el frontend pueda manejarlo
    throw error;
  }
}

export async function getExchangeRates() {
  try {
    const { data } = await http.get('/exchange-rates');
    return data || [];
  } catch {
    return [];
  }
}


export async function createExpense(payload) {
  const { data } = await http.post('/expenses', payload);
  return data;
}

export async function updateExpense(id, payload) {
  const { data } = await http.put(`/expenses/${id}`, payload);
  return data;
}

export async function deleteExpense(id) {
  const { data } = await http.delete(`/expenses/${id}`);
  return data;
}

export async function createIncome(payload) {
  const { data } = await http.post('/income', payload);
  return data;
}

export async function updateIncome(id, payload) {
  const { data } = await http.put(`/income/${id}`, payload);
  return data;
}

export async function deleteIncome(id) {
  const { data } = await http.delete(`/income/${id}`);
  return data;
}


export async function getFAConfig() {
  try {
    const { data } = await http.get('/fa-config');
    return data || {
      fixed: [],
      wellbeing: [],
      saving: [],
      targets: { fixed: 50, wellbeing: 30, saving: 20 },
    };
  } catch {
    return {
      fixed: [],
      wellbeing: [],
      saving: [],
      targets: { fixed: 50, wellbeing: 30, saving: 20 },
    };
  }
}

export async function updateFAConfig(payload) {
  const { data } = await http.put('/fa-config', payload);
  return data;
}

export async function getInvestments() {
  try {
    const { data } = await http.get('/investments');
    return data ?? [];
  } catch {
    return [];
  }
}

export async function createInvestment(payload) {
  const { data } = await http.post('/investments', payload);
  return data;
}

export async function updateInvestment(id, payload) {
  const { data } = await http.patch(`/investments/${id}`, payload);
  return data;
}

export async function deleteInvestment(id) {
  const { data } = await http.delete(`/investments/${id}`);
  return data;
}

export async function updatePrices() {
  const { data } = await http.post('/prices/update');
  return data;
}

export async function updateInvestmentPrices() {
  const { data } = await http.post('/prices/update-investments');
  return data;
}

export async function getPrice(symbol) {
  try {
    const { data } = await http.get(`/prices/symbol/${symbol}`);
    return data?.price || null;
  } catch (error) {
    console.error(`Error getting price for ${symbol}:`, error);
    return null;
  }
}

export async function getAvailableSymbols(type, query) {
  try {
    const url = query 
      ? `/prices/symbols/${type}?query=${encodeURIComponent(query)}`
      : `/prices/symbols/${type}`;
    const { data } = await http.get(url);
    return data || [];
  } catch (error) {
    console.error(`Error getting available symbols for ${type}:`, error);
    return [];
  }
}

export async function getInvestmentOperations(investmentId) {
  const params = investmentId ? { investmentId } : {};
  const { data } = await http.get('/investment-operations', { params });
  return data;
}

export async function createInvestmentOperation(payload) {
  const { data } = await http.post('/investment-operations', payload);
  return data;
}

export async function updateInvestmentOperation(id, payload) {
  const { data } = await http.patch(`/investment-operations/${id}`, payload);
  return data;
}

export async function deleteInvestmentOperation(id) {
  const { data } = await http.delete(`/investment-operations/${id}`);
  return data;
}





