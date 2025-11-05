import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Sidebar from '../components/Sidebar.jsx';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background-light text-[#111318] dark:bg-background-dark dark:text-gray-100">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <Navbar />
          <main className="flex-1 p-6 lg:p-8 w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}





