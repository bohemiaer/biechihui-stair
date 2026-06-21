import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen w-full bg-[#FFFFFF] text-[#1A1A1A] font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden relative flex flex-col bg-[#FFFFFF]">
        <Outlet />
      </main>
    </div>
  );
}
