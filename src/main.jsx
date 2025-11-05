import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import AppLayout from './ui/AppLayout.jsx';
import { AppProvider } from './context/AppContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Expenses from './pages/Expenses.jsx';
import Income from './pages/Income.jsx';
import Upload from './pages/Upload.jsx';
import People from './pages/People.jsx';
import Spreadsheet from './pages/Spreadsheet.jsx';
import Investments from './pages/Investments.jsx';

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}> 
            <Route index element={<Navigate to="/spreadsheet" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/income" element={<Income />} />
            <Route path="/people" element={<People />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/spreadsheet" element={<Spreadsheet />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);



