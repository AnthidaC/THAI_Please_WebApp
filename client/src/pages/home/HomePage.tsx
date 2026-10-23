import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  QrCode,
  Store,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[85vh] bg-surface-soft py-6 md:py-8 px-4 pb-24 md:pb-12 font-sans text-ink">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="rounded-card border border-hairline bg-white p-8 shadow-sm text-center">
          <div className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue-light px-3 py-1 text-xs font-semibold text-brand-blue border border-blue-200 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>แพลตฟอร์มดิจิทัลกระตุ้นเศรษฐกิจฐานราก</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            ไทยช่วยไทยพลีส (THAI Please)
          </h1>
          <p className="mt-3 text-sm text-ink-body max-w-xl mx-auto leading-relaxed">
            ระบบกระเป๋าเงินดิจิทัล ชำระเงินร่วม (Co-pay 60/40) สแกน Dynamic QR หน้าร้าน
            พร้อมระบบตรวจจับการทุจริตพิกัด GPS & Semi-AI Anomaly Engine มาตรฐานสากล
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="inline-flex items-center space-x-2 rounded-pill bg-brand-blue px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-95"
            >
              <Wallet className="h-4 w-4" />
              <span>เข้าสู่กระเป๋าเงิน (Citizen Wallet)</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_SCAN_COPAY)}
              className="inline-flex items-center space-x-2 rounded-pill border border-hairline bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-gray-50 transition"
            >
              <QrCode className="h-4 w-4 text-brand-blue" />
              <span>สแกนชำระเงินร่วม (Co-pay 60/40)</span>
            </button>
          </div>
        </div>

        <section className="rounded-card border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-ink">ทางเข้าสำหรับทดสอบตามบทบาท</h2>
          <p className="mt-1 text-xs text-ink-muted">
            เลือกหน้าล็อกอินให้ตรงกับประเภทบัญชี
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => navigate(APP_ROUTES.LOGIN)}
              className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-semibold text-brand-blue transition hover:bg-blue-50"
            >
              เข้าสู่ระบบประชาชน
            </button>
            <button
              onClick={() => navigate(APP_ROUTES.MERCHANT_LOGIN)}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              เข้าสู่ระบบร้านค้า
            </button>
            <button
              onClick={() => navigate(APP_ROUTES.STAFF_LOGIN)}
              className="rounded-xl border border-red-200 bg-white px-4 py-3 text-xs font-semibold text-status-error transition hover:bg-red-50"
            >
              เข้าสู่ระบบเจ้าหน้าที่
            </button>
          </div>
        </section>

        {/* เมนูทางลัดตามบทบาท 3 กลุ่ม (Citizen, Merchant, Admin) */}
        <div>
          <h2 className="text-base font-bold text-ink mb-4">โมดูลงาน Developer 2: Payment & Fraud Engine</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: ฝั่งประชาชน */}
            <div
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="rounded-card border border-hairline bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-brand-blue-light text-brand-blue flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <Wallet className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-ink">ฝั่งประชาชน (Citizen)</h3>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                  • 2.2 กระเป๋าเงินดิจิทัล & โควตารัฐสมทบ 60%<br />
                  • 2.2.1 สแกน QR ร่วมจ่าย Co-pay 60/40<br />
                  • 2.2.2 ใบเสร็จ e-Slip พร้อมสิทธิ์รีวิว 24 ชม.<br />
                  • 2.5.1 ประวัติการทำธุรกรรม
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-brand-blue">
                <span>เปิดใช้งานกระเป๋าเงิน</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 2: ฝั่งร้านค้า */}
            <div
              onClick={() => navigate(APP_ROUTES.MERCHANT_POS_QR)}
              className="rounded-card border border-hairline bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-status-success flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <Store className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-ink">ฝั่งร้านค้า (Merchant)</h3>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                  • 3.2.1 สร้าง Dynamic QR ขนาดใหญ่ 300x300<br />
                  • ระบุยอดเรียกเก็บและบันทึกพิกัดร้านค้า<br />
                  • 3.3.1 ประวัติการรับเงินและสถิติการขาย<br />
                  • สรุปยอดเงินอุดหนุนรัฐ 60% และลูกค้า 40%
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-status-success">
                <span>เปิดระบบสร้าง QR หน้าร้าน</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 3: ฝั่งผู้ดูแลระบบ */}
            <div
              onClick={() => navigate(APP_ROUTES.ADMIN_FRAUD_ALERTS)}
              className="rounded-card border border-red-100 bg-white p-6 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-red-50 text-status-error flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-ink">ฝั่งผู้ดูแลระบบ (Admin)</h3>
                <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                  • 4.2 ระบบตรวจจับทุจริตพิกัด GPS Geofence<br />
                  • Semi-AI Anomaly Scoring แบบหลายมิติ<br />
                  • รายการธุรกรรมต้องสงสัย (Flagged Queue)<br />
                  • ปุ่มตรวจสอบและอนุมัติ/ระงับรายการ
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-status-error">
                <span>เปิดแดชบอร์ดตรวจทุจริต</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>
        </div>

        {/* มาตรฐานวิศวกรรมซอฟต์แวร์ระดับสากล */}
        <div className="rounded-card border border-hairline bg-white p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="h-8 w-8 text-brand-blue" />
            <div>
              <h4 className="text-sm font-bold text-ink">พัฒนาตามมาตรฐาน Dev ระดับสากล</h4>
              <p className="text-xs text-ink-muted">
                Clean Architecture, TDD Unit Tests, Zero-Bug Regression, Responsive WCAG 2.1 AA
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-brand-blue bg-brand-blue-light px-3 py-1 rounded-pill">
            branch: developer-2-payment-fraud-engine
          </span>
        </div>
      </div>
    </div>
  );
};
