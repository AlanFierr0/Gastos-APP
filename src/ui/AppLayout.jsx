import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';

export default function AppLayout() {
  return (
    <div className="h-screen bg-background-light text-[#111318] dark:bg-background-dark dark:text-gray-100 overflow-hidden">
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
          <main className="flex-1 p-6 lg:p-8 w-full overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}





