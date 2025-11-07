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

export async function confirmImport(records) {
  const { data } = await http.post('/upload/confirm', { records });
  return data;
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





