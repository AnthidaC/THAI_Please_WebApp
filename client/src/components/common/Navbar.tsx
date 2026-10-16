import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';
import { NAV_BY_ROLE, ROLE_LABEL, resolveNavRole } from './navConfig';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  // เมนูแยกตามบทบาท (ประชาชน / ร้านค้า / ผู้ดูแลระบบ) — ไม่รวมเมนูหลายบทบาทไว้ด้วยกัน
  const role = resolveNavRole(user?.role, location.pathname);
  const navItems = NAV_BY_ROLE[role];
  const RoleIcon = ROLE_LABEL[role].icon;
  const isAdmin = role === 'ADMIN';

  return (
    <>
      {/* 1. TOP NAVBAR (Responsive: Full on Desktop, Clean & Compact on Mobile) */}
      <nav className="bg-white border-b border-hairline px-4 lg:px-8 py-2.5 shadow-sm sticky top-0 z-30 font-sans">
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
          {/* Brand Logo & Name */}
          <div
            onClick={() => navigate(APP_ROUTES.HOME)}
            className="flex items-center space-x-2.5 cursor-pointer select-none min-w-0"
          >
            <div className="h-9 w-9 shrink-0 rounded-2xl bg-brand-blue flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/25">
              TP
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base text-ink tracking-tight flex items-center space-x-1.5 leading-none">
                <span>THAI Please</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-blue bg-brand-blue-light px-2 py-0.5 rounded-pill border border-blue-200 whitespace-nowrap">
                  <RoleIcon className="h-3 w-3" />
                  {ROLE_LABEL[role].label}
                </span>
              </span>
              <span className="text-[11px] text-ink-muted block mt-0.5 truncate">
                กระเป๋าเงินดิจิทัล &amp; ระบบชำระเงินร่วม
              </span>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Links — เฉพาะเมนูของบทบาทปัจจุบัน (ซ่อนบนมือถือ) */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-1.5 text-xs font-medium">
            {navItems.map(({ to, label, fullLabel, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex items-center space-x-1.5 px-2.5 lg:px-3 py-1.5 rounded-pill transition whitespace-nowrap ${
                    isActive
                      ? isAdmin
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-brand-blue text-white shadow-sm'
                      : 'text-ink-body hover:bg-surface-soft hover:text-ink'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="hidden lg:inline">{fullLabel ?? label}</span>
                  <span className="lg:hidden">{label}</span>
                </span>
              </NavLink>
            ))}
          </div>

          {/* User Session Info / Auth */}
          <div className="flex items-center space-x-2 shrink-0">
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

      {/* 2. MOBILE BOTTOM NAVIGATION BAR — แสดงเฉพาะเมนูของบทบาทปัจจุบัน (Thumb-friendly) */}
      {navItems.length > 1 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-hairline px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex justify-around items-end shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden">
          {navItems.map(({ to, label, icon: Icon, primary }) =>
            primary ? (
              <NavLink key={to} to={to} className="flex flex-col items-center -mt-5">
                {({ isActive }) => (
                  <>
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition transform active:scale-95 bg-brand-blue text-white ${
                        isActive ? 'shadow-blue-500/40 ring-2 ring-brand-blue' : 'shadow-blue-500/30'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`text-[10px] mt-1 ${isActive ? 'text-brand-blue font-bold' : 'text-ink-body font-medium'}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center py-1 px-3 rounded-xl transition ${
                    isActive ? 'text-brand-blue font-semibold' : 'text-ink-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">{label}</span>
              </NavLink>
            )
          )}
        </div>
      )}
    </>
  );
};
