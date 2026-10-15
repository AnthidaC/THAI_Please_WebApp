import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-surface-soft font-sans text-ink">
      {/* Unified Responsive Navigation (Top bar on Desktop, Top & Bottom Nav on Mobile) */}
      <Navbar />

      {/* Main Page Outlet */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Desktop Footer (Hidden on mobile to keep mobile bottom nav clear) */}
      <footer className="hidden md:block border-t border-hairline bg-white py-4 px-6 text-center text-xs text-ink-muted">
        โครงการไทยช่วยไทยพลีส (THAI Please) &bull; แพลตฟอร์มดิจิทัลชำระเงินร่วม Co-pay 60/40 &bull; กระทรวงการคลัง
      </footer>
    </div>
  );
};

