import React from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { ScrollToTop } from '../components/common/ScrollToTop';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-surface-soft font-sans text-ink">
      {/* เลื่อนหน้าจอขึ้นบนสุดเสมอเมื่อเปลี่ยนหน้า (Route change) รองรับทุกอุปกรณ์ */}
      <ScrollToTop />
      <ScrollRestoration />

      {/* Unified Responsive Navigation (Top bar on Desktop, Top & Bottom Nav on Mobile) */}
      <Navbar />

      {/* Main Page Outlet */}
      <main id="main-content" tabIndex={-1} className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-hairline bg-white px-6 py-5 text-center text-sm text-ink-muted">
        โครงการไทยช่วยไทยพลีส (THAI Please) &bull; แพลตฟอร์มดิจิทัลชำระเงินร่วม Co-pay 60/40 &bull; กระทรวงการคลัง
      </footer>
    </div>
  );
};

