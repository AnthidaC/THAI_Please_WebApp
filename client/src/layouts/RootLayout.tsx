import React from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { ScrollToTop } from '../components/common/ScrollToTop';
import { PaymentPinGate } from '../components/payment/PaymentPinGate';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-full overflow-x-hidden flex flex-col bg-surface-soft font-sans text-ink">
      {/* เลื่อนหน้าจอขึ้นบนสุดเสมอเมื่อเปลี่ยนหน้า (Route change) รองรับทุกอุปกรณ์ */}
      <ScrollToTop />
      <ScrollRestoration />
      <PaymentPinGate />

      {/* Unified Neutral Navigation (Top bar on Desktop/Mobile + Fixed Stationary Bottom Nav on Mobile) */}
      <Navbar />

      {/* Main Page Outlet — เผื่อระยะด้านล่างสำหรับแถบนำทางมือถือที่ติดขอบจอล่างเสมอ */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Desktop Footer (Hidden on mobile to keep mobile bottom nav clear) */}
      <footer className="hidden md:block border-t border-hairline bg-white py-4 px-6 text-center text-xs text-ink-muted leading-normal">
        โครงการไทยช่วยไทยพลีส (THAI Please) &bull; แพลตฟอร์มดิจิทัลชำระเงินร่วม Co-pay 60/40 &bull; กระทรวงการคลัง
      </footer>
    </div>
  );
};
