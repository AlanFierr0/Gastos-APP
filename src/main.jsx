import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import AppLayout from './ui/AppLayout.jsx';
import { AppProvider } from './context/AppContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import Spreadsheet from './pages/Spreadsheet.jsx';
import Grid from './pages/Grid.jsx';
import Forecast from './pages/Forecast.jsx';
import FinancialAnalysis from './pages/FinancialAnalysis.jsx';
import NotFound from './pages/NotFound.jsx';

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}> 
            <Route index element={<Navigate to="/spreadsheet" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/** expenses/income removidos **/}
            <Route path="/analysis" element={<FinancialAnalysis />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/spreadsheet" element={<Spreadsheet />} />
            <Route path="/grid" element={<Grid />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);



