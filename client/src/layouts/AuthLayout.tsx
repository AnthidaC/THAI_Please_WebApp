import React from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { ScrollToTop } from '../components/common/ScrollToTop';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col bg-surface-soft font-sans text-ink">
      <ScrollToTop />
      <ScrollRestoration />

      {/* แถบนำทางกลางคงที่ทุกหน้า */}
      <Navbar />

      <main className="flex-1 w-full flex flex-col justify-center items-center px-3.5 sm:px-6 py-6 sm:py-10 pb-24 md:pb-12">
        <div className="w-full max-w-md bg-white p-5 sm:p-7 rounded-card shadow-sm border border-hairline">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
