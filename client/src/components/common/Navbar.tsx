import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Wallet, QrCode, Store, ShieldAlert, TrendingUp, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  return (
    <nav className="bg-white border-b border-hairline px-4 lg:px-6 py-3 shadow-sm sticky top-0 z-30 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Brand Logo & Name */}
        <div
          onClick={() => navigate(APP_ROUTES.HOME)}
          className="flex items-center space-x-2.5 cursor-pointer"
        >
          <div className="h-9 w-9 rounded-2xl bg-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/20">
            TP
          </div>
          <div>
            <span className="font-bold text-base text-ink tracking-tight flex items-center space-x-1.5">
              <span>THAI Please</span>
              <span className="text-[10px] font-semibold text-brand-blue bg-brand-blue-light px-2 py-0.5 rounded-pill border border-blue-200">
                Co-pay 60/40
              </span>
            </span>
            <span className="text-[11px] text-ink-muted block leading-none">
              โครงการกระตุ้นเศรษฐกิจดิจิทัล
            </span>
          </div>
        </div>

        {/* Navigation Links for Developer 2 & Flows */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-medium">
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

        {/* User Session Info */}
        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-ink-muted">
                สวัสดี, <strong className="text-ink font-semibold">{user?.name || 'ผู้ใช้งาน'}</strong>
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
              className="px-3.5 py-1.5 text-xs font-semibold rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover transition"
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
