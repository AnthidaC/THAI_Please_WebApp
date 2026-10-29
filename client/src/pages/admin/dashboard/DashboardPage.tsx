import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Store,
  ShieldAlert,
  Megaphone,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { APP_ROUTES } from '../../../constants/routes';

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'MERCHANT') return <Navigate to={APP_ROUTES.MERCHANT_HOME} replace />;
  if (user?.role === 'ADMIN' || user?.role === 'STAFF') return <Navigate to={APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS} replace />;
  if (user?.role === 'GOVERNMENT_EXECUTIVE') return <Navigate to={APP_ROUTES.ADMIN_SOCIAL_IMPACT} replace />;

  return (
    <div className="min-h-[85vh] bg-surface-soft py-6 md:py-8 px-4 pb-24 md:pb-12 font-sans text-ink">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Banner ส่วนหัว Dashboard */}
        <div className="rounded-card border border-hairline bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-brand-blue text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/25 shrink-0">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-ink truncate">
                    แดชบอร์ดผู้ดูแลระบบ (Admin Dashboard)
                  </h1>
                  <span className="inline-flex items-center space-x-1 rounded-pill bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-status-success border border-emerald-200 shrink-0">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>ยืนยันตัวตนแล้ว</span>
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5 truncate">
                  ยินดีต้อนรับเข้าสู่ระบบจัดการและบริการโครงการไทยช่วยไทยพลีส
                </p>
              </div>
            </div>

  return <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-brand-blue">พื้นที่ประชาชน</p>
        <h1 className="mt-2 text-2xl font-bold">สวัสดี{user?.name ? ` คุณ${user.name}` : ' ยินดีต้อนรับ'}</h1>
        <p className="mt-2 text-base text-ink-muted">สถานะการลงทะเบียนรับสิทธิ์: <span className="font-semibold text-status-success">ลงทะเบียนแล้ว</span></p>
        <p className="mt-1 text-sm text-ink-muted">สถานะนี้บันทึกในอุปกรณ์สำหรับหน้าทดลอง ยังไม่ได้ตรวจสอบกับระบบสิทธิ์จริง</p>
      </section>
      <section aria-labelledby="citizen-shortcuts-title">
        <h2 id="citizen-shortcuts-title" className="mb-3 text-lg font-bold">บริการสำหรับคุณ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CITIZEN_HOME_CARDS.map((card) => {
            const Icon = card.icon;
            const content = <><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">{Icon && <Icon aria-hidden="true" className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block text-base font-bold">{card.label}</span><span className="mt-1 block text-sm text-ink-muted">{card.comingSoon ? 'บริการนี้กำลังเตรียมให้ใช้งาน' : 'เปิดบริการ'}</span></span>{card.comingSoon ? <span className="rounded-pill bg-surface-soft px-3 py-1 text-sm font-semibold text-ink-muted">เร็วๆ นี้</span> : <ArrowRight aria-hidden="true" className="h-5 w-5 text-brand-blue" />}</>;
            return card.to && !card.comingSoon
              ? <Link key={card.label} to={card.to} className="flex min-h-24 items-center gap-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm hover:border-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{content}</Link>
              : <div key={card.label} className="flex min-h-24 items-center gap-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm">{content}</div>;
          })}
        </div>

        {/* ข้อมูลการเข้าสู่ระบบปัจจุบัน (Authentication Details Card) */}
        <div className="rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink flex items-center space-x-1.5">
              <KeyRound className="h-4 w-4 text-brand-blue" />
              <span>ข้อมูลการตรวจสอบสิทธิ์ความปลอดภัย (Active Session)</span>
            </h2>
            <span className="text-[11px] font-mono font-semibold text-brand-blue bg-blue-50 px-2.5 py-0.5 rounded-pill border border-blue-200">
              JWT Authenticated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-2xl bg-surface-soft p-3">
              <span className="text-[10px] text-ink-muted font-medium block">ชื่อผู้ใช้งาน</span>
              <span className="text-xs font-bold text-ink truncate block mt-0.5">
                {user?.name || 'ผู้ใช้งานระบบ'}
              </span>
            </div>

            <div className="rounded-2xl bg-surface-soft p-3">
              <span className="text-[10px] text-ink-muted font-medium block">อีเมล / บัญชี</span>
              <span className="text-xs font-mono text-ink truncate block mt-0.5">
                {user?.email || 'authenticated-user@thaiplease.go.th'}
              </span>
            </div>

            <div className="rounded-2xl bg-surface-soft p-3">
              <span className="text-[10px] text-ink-muted font-medium block">บทบาทในระบบ (Role)</span>
              <span className="text-xs font-bold text-brand-blue truncate block mt-0.5">
                {user?.role || 'CITIZEN'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-2xl border border-hairline text-[11px] font-mono text-ink-muted break-all">
            <span className="font-semibold text-ink">Authorization Token: </span>
            {token ? `${token.slice(0, 36)}...` : 'None'}
          </div>
        </div>

        {/* ทางลัดเข้าใช้งานโมดูลงาน (Role Modules Quick Links) */}
        <div>
          <h2 className="text-base font-bold text-ink mb-3.5">
            เลือกโมดูลที่ต้องการดำเนินการและตรวจสอบ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Citizen Wallet */}
            <div
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="rounded-card border border-hairline bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-brand-blue-light text-brand-blue flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-ink">กระเป๋าเงินประชาชน (Wallet)</h3>
                <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  ตรวจสอบยอดคงเหลือ โควตารัฐสมทบ 60% เติมเงิน และดูประวัติการทำธุรกรรม
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-brand-blue">
                <span>เปิดกระเป๋าเงิน</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Merchant POS */}
            <div
              onClick={() => navigate(APP_ROUTES.MERCHANT_POS_QR)}
              className="rounded-card border border-hairline bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <Store className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-ink">ระบบสร้าง QR ร้านค้า (POS)</h3>
                <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  ระบุยอดเงิน สร้าง Dynamic QR หน้าร้าน แจ้งเตือนเงินเข้าสด และสถิติยอดขาย
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-status-success">
                <span>เปิดระบบหน้าร้าน</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Admin Fraud */}
            <div
              onClick={() => navigate(APP_ROUTES.ADMIN_FRAUD_ALERTS)}
              className="rounded-card border border-red-100 bg-white p-5 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-xl bg-red-50 text-status-error flex items-center justify-center mb-3 group-hover:scale-105 transition">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-ink">ตรวจสอบทุจริต (Fraud Engine)</h3>
                <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  ตรวจสอบพิกัด GPS Geofence รายการธุรกรรมต้องสงสัย และแผนที่ OpenStreetMap
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-xs font-semibold text-status-error">
                <span>เปิดแดชบอร์ดตรวจทุจริต</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {user?.role === 'ADMIN' && (
              <Link
                to={APP_ROUTES.ADMIN_CAMPAIGNS}
                className="rounded-card border border-blue-100 bg-white p-5 shadow-sm hover:shadow-md transition group flex flex-col justify-between focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              >
                <div>
                  <div className="h-10 w-10 rounded-xl bg-brand-blue-light text-brand-blue flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">แคมเปญและสิทธิประโยชน์ (Dev 4)</h3>
                  <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                    จัดการแคมเปญ ภารกิจ รางวัล และแบดจ์สำหรับประชาชน
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-xs font-semibold text-brand-blue">
                  <span>เปิดหน้าจัดการ Dev 4</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Security Badge */}
        <div className="rounded-2xl border border-hairline bg-white p-4 shadow-xs flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>เข้าสู่ระบบอย่างปลอดภัยผ่าน Route Guard: AdminRoute</span>
          </div>
          <span className="font-mono text-[11px] font-semibold text-ink">
            Status: Active
          </span>
        </div>
      </div>
    </div>
  </main>;
};
