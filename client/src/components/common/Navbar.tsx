import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';
import {
  NAV_BY_ROLE,
  ROLE_LABEL,
  resolveNavRole,
  isNavItemActive,
} from './navConfig';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  const pathname = location.pathname;
  const role = resolveNavRole(user?.role, pathname);
  const navItems = NAV_BY_ROLE[role];
  const RoleIcon = ROLE_LABEL[role].icon;

  // จำนวนคอลัมน์คงที่ตามบทบาท เพื่อให้แต่ละปุ่มมีขนาดเท่ากันและปุ่มสำคัญอยู่กึ่งกลางพอดี
  const mobileGridColsClass =
    navItems.length === 5
      ? 'grid-cols-5'
      : navItems.length === 4
      ? 'grid-cols-4'
      : 'grid-cols-3';

  return (
    <>
      {/* 1. TOP NAVBAR (Responsive: Full on Desktop & Tablet, Clean & Proportional on Mobile) */}
      <header className="bg-white border-b border-hairline sticky top-0 z-40 w-full font-sans shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2.5 sm:gap-4">
          {/* Brand Logo & Name */}
          <Link
            to={APP_ROUTES.HOME}
            className="flex items-center gap-2.5 sm:gap-3 select-none min-w-0 shrink-0 group"
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-2xl bg-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/25 group-hover:bg-brand-blue-hover transition-colors">
              TP
            </div>
            <div className="min-w-0">
              <div className="font-bold text-base sm:text-lg text-ink tracking-tight flex items-center gap-1.5 leading-normal">
                <span className="truncate">THAI Please</span>
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-brand-blue bg-brand-blue-light px-2 sm:px-2.5 py-0.5 rounded-pill border border-blue-200 whitespace-nowrap shrink-0 leading-normal">
                  <RoleIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{ROLE_LABEL[role].label}</span>
                </span>
              </div>
              <span className="text-xs text-ink-muted block truncate leading-normal">
                กระเป๋าเงินดิจิทัล &amp; ระบบชำระเงินร่วม
              </span>
            </div>
          </Link>

          {/* Desktop & Tablet Navigation Links — แยกตามบทบาท และเน้นปุ่มสำคัญให้โดดเด่นชัดเจน */}
          <nav
            aria-label="แถบนำทางหลัก"
            className="hidden md:flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm font-medium overflow-x-auto no-scrollbar py-0.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item, pathname);

              if (item.primary) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-1.5 px-3.5 lg:px-4 py-2 rounded-pill transition-colors whitespace-nowrap leading-normal font-bold ${
                      active
                        ? 'bg-brand-blue text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-200'
                        : 'bg-brand-blue text-white shadow-sm shadow-blue-500/20 hover:bg-brand-blue-hover'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="hidden lg:inline">{item.fullLabel ?? item.label}</span>
                      <span className="lg:hidden">{item.label}</span>
                    </span>
                  </Link>
                );
              }

              if (item.highlightDanger) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`inline-flex items-center gap-1.5 px-3 lg:px-3.5 py-2 rounded-pill transition-colors whitespace-nowrap leading-normal font-semibold ${
                      active
                        ? 'bg-red-600 text-white shadow-md shadow-red-500/25 ring-2 ring-red-200'
                        : 'bg-red-50 text-status-error border border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="hidden lg:inline">{item.fullLabel ?? item.label}</span>
                      <span className="lg:hidden">{item.label}</span>
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-1.5 px-3 lg:px-3.5 py-2 rounded-pill transition-colors whitespace-nowrap leading-normal ${
                    active
                      ? 'bg-brand-blue-light text-brand-blue border border-blue-200 font-bold shadow-2xs'
                      : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>
                    <span className="hidden lg:inline">{item.fullLabel ?? item.label}</span>
                    <span className="lg:hidden">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* User Session Info / Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs lg:text-sm text-ink-muted hidden lg:inline leading-normal">
                  สวัสดี, <strong className="text-ink font-semibold">{user?.name || 'ผู้ใช้งาน'}</strong>
                </span>
                <span className="text-xs font-semibold text-brand-blue bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-pill lg:hidden leading-normal max-w-[115px] truncate">
                  {user?.name || 'ผู้ใช้งาน'}
                </span>
                <button
                  type="button"
                  onClick={clearAuth}
                  className="p-2 text-xs text-status-error hover:bg-red-50 rounded-pill transition-colors border border-red-200"
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.LOGIN)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover transition-colors shadow-sm whitespace-nowrap leading-normal"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR — ติดขอบจอล่างคงที่ ไม่ขยับเขยื้อน ขนาดสมดุลกับหน้าจอมือถือ และปุ่มสำคัญโดดเด่นชัดเจน */}
      {navItems.length > 1 && (
        <nav
          aria-label="แถบนำทางล่างสำหรับมือถือ"
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-hairline shadow-[0_-4px_20px_rgba(15,23,42,0.10)] select-none"
        >
          <div
            className={`grid ${mobileGridColsClass} items-end h-[72px] px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] max-w-lg mx-auto`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(item, pathname);

              // ปุ่มสำคัญตรงกลาง (เช่น สแกนจ่าย / สร้าง QR) — ขนาดใหญ่โดดเด่นชัดเจนในช่องความสูงคงที่
              if (item.primary) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="relative flex flex-col items-center justify-end h-[72px] pb-1"
                  >
                    <div
                      className={`-mt-7 h-14 w-14 rounded-full flex items-center justify-center border-4 border-white bg-brand-blue text-white transition-shadow duration-150 ${
                        active
                          ? 'shadow-xl shadow-blue-600/45 ring-2 ring-brand-blue'
                          : 'shadow-lg shadow-blue-600/35'
                      }`}
                    >
                      <Icon className="h-6 w-6 shrink-0" />
                    </div>
                    <span
                      className={`text-xs font-bold mt-0.5 leading-normal whitespace-nowrap ${
                        active ? 'text-brand-blue' : 'text-ink'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              }

              // ปุ่มเฝ้าระวังสำคัญของแอดมิน (ตรวจทุจริต)
              if (item.highlightDanger) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex flex-col items-center justify-end h-[72px] pb-1"
                  >
                    <div
                      className={`flex items-center justify-center h-8 w-12 rounded-pill transition-colors duration-150 ${
                        active
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-red-50 text-status-error border border-red-200'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                    </div>
                    <span
                      className={`text-xs font-bold mt-0.5 leading-normal whitespace-nowrap ${
                        active ? 'text-status-error' : 'text-status-error/90'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              }

              // ปุ่มเมนูมาตรฐานในบทบาทนั้น ๆ
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center justify-end h-[72px] pb-1 transition-colors duration-150 ${
                    active ? 'text-brand-blue' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-8 w-12 rounded-pill transition-colors duration-150 ${
                      active ? 'bg-brand-blue-light text-brand-blue' : 'bg-transparent'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                  </div>
                  <span
                    className={`text-xs font-semibold mt-0.5 leading-normal whitespace-nowrap ${
                      active ? 'text-brand-blue' : 'text-ink-muted'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};
