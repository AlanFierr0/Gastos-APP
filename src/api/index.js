// Simple API layer for a NestJS backend
// Adjust BASE_URL to match your server
import axios from 'axios';

const BASE_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:6543';
const http = axios.create({ baseURL: BASE_URL, timeout: 12000 });

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

export async function getPersons() {
  try {
    const { data } = await http.get('/persons');
    return data ?? [];
  } catch {
    return [];
  }
}

export async function createPerson(payload) {
  const { data } = await http.post('/persons', payload);
  return data;
}

export async function uploadExcel(formData) {
  const { data } = await http.post('/upload/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function createExpense(payload) {
  const { data } = await http.post('/expenses', payload);
  return data;
}

export async function createIncome(payload) {
  const { data } = await http.post('/income', payload);
  return data;
}





