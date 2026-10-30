import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-surface-soft">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white p-6 rounded-card shadow-sm border border-hairline">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
