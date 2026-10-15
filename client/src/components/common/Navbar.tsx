import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Wallet, QrCode, Store, ShieldAlert, TrendingUp, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  const isCitizenScanActive = location.pathname === APP_ROUTES.CITIZEN_SCAN_COPAY;

  return (
    <>
      {/* 1. TOP NAVBAR (Responsive: Full on Desktop, Clean & Compact on Mobile) */}
      <nav className="bg-white border-b border-hairline px-4 lg:px-8 py-2.5 shadow-sm sticky top-0 z-30 font-sans">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Brand Logo & Name */}
          <div
            onClick={() => navigate(APP_ROUTES.HOME)}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div className="h-9 w-9 rounded-2xl bg-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/25">
              TP
            </div>
            <div>
              <span className="font-bold text-base text-ink tracking-tight flex items-center space-x-1.5 leading-none">
                <span>THAI Please</span>
                <span className="text-[10px] font-semibold text-brand-blue bg-brand-blue-light px-2 py-0.5 rounded-pill border border-blue-200">
                  Co-pay 60/40
                </span>
              </span>
              <span className="text-[11px] text-ink-muted block mt-0.5">
                กระเป๋าเงินดิจิทัล & ระบบชำระเงินร่วม
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-1 text-xs font-medium">
            <NavLink
              to={APP_ROUTES.CITIZEN_WALLET}
              className={({ isActive }) =>
                `inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill transition ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                }`
              }
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>กระเป๋าเงิน (Citizen)</span>
            </NavLink>

            <NavLink
              to={APP_ROUTES.CITIZEN_SCAN_COPAY}
              className={({ isActive }) =>
                `inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill transition ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                }`
              }
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>สแกนจ่าย Co-pay</span>
            </NavLink>

            <NavLink
              to={APP_ROUTES.MERCHANT_POS_QR}
              className={({ isActive }) =>
                `inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill transition ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                }`
              }
            >
              <Store className="h-3.5 w-3.5" />
              <span>ร้านค้าสร้าง QR</span>
            </NavLink>

            <NavLink
              to={APP_ROUTES.MERCHANT_SALES}
              className={({ isActive }) =>
                `inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill transition ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                }`
              }
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>สถิติยอดขาย</span>
            </NavLink>

            <NavLink
              to={APP_ROUTES.ADMIN_FRAUD_ALERTS}
              className={({ isActive }) =>
                `inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill transition ${
                  isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-status-error bg-red-50 hover:bg-red-100'
                }`
              }
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>ตรวจจับทุจริต (Admin)</span>
            </NavLink>
          </div>

          {/* User Session Info / Auth */}
          <div className="flex items-center space-x-2">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-ink-muted hidden sm:inline">
                  สวัสดี, <strong className="text-ink font-semibold">{user?.name || 'ผู้ใช้งาน'}</strong>
                </span>
                <span className="text-[11px] font-bold text-brand-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-pill sm:hidden">
                  {user?.name?.slice(0, 8) || 'ผู้ใช้'}
                </span>
                <button
                  onClick={clearAuth}
                  className="p-1.5 text-xs text-status-error hover:bg-red-50 rounded-pill transition border border-red-200"
                  title="ออกจากระบบ"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate(APP_ROUTES.LOGIN)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover transition shadow-sm"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR (Thumb-friendly for Citizens & Merchants on Mobile) */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-hairline py-1 px-2 flex justify-around items-center shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden">
        {/* 1. Citizen Wallet */}
        <NavLink
          to={APP_ROUTES.CITIZEN_WALLET}
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive ? 'text-brand-blue font-semibold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Wallet className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">กระเป๋าเงิน</span>
        </NavLink>

        {/* 2. Merchant POS QR */}
        <NavLink
          to={APP_ROUTES.MERCHANT_POS_QR}
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive ? 'text-brand-blue font-semibold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Store className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">สร้าง QR</span>
        </NavLink>

        {/* 3. Center Highlighted Scan Button */}
        <NavLink
          to={APP_ROUTES.CITIZEN_SCAN_COPAY}
          className="flex flex-col items-center -mt-5"
        >
          <div
            className={`h-12 w-12 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition transform active:scale-95 ${
              isCitizenScanActive
                ? 'bg-brand-blue text-white shadow-blue-500/40 ring-2 ring-brand-blue'
                : 'bg-brand-blue text-white shadow-blue-500/30'
            }`}
          >
            <QrCode className="h-6 w-6" />
          </div>
          <span className={`text-[10px] mt-1 ${isCitizenScanActive ? 'text-brand-blue font-bold' : 'text-ink-body font-medium'}`}>
            สแกนจ่าย
          </span>
        </NavLink>

        {/* 4. Merchant Sales */}
        <NavLink
          to={APP_ROUTES.MERCHANT_SALES}
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive ? 'text-brand-blue font-semibold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">ยอดขาย</span>
        </NavLink>

        {/* 5. Admin Fraud */}
        <NavLink
          to={APP_ROUTES.ADMIN_FRAUD_ALERTS}
          className={({ isActive }) =>
            `flex flex-col items-center py-1 px-2 rounded-xl transition ${
              isActive ? 'text-status-error font-semibold' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <ShieldAlert className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">ตรวจทุจริต</span>
        </NavLink>
      </div>
    </>
  );
};

