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
            {/** expenses/income removidos **/}
            <Route path="/investments" element={<Investments />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/spreadsheet" element={<Spreadsheet />} />
            <Route path="/grid" element={<Grid />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);



