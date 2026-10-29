import React from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LogIn } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { ROLE_CONFIG, getNavItems, resolveNavRole } from './navConfig';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  // เมนูแยกตามบทบาท (ประชาชน / ร้านค้า / ผู้ดูแลระบบ) — แยกตามบทบาทเด็ดขาด ไม่ปนกัน
  const role = resolveNavRole(user?.role, location.pathname);
  const homePath = isAuthenticated ? homeRouteForRole(user?.role) : APP_ROUTES.HOME;
  const roleConfig = ROLE_CONFIG[role];
  const isMerchant = role === 'MERCHANT';
  const isAdmin = role === 'ADMIN';

  // แสดงแถบนำทางของร้านค้าเฉพาะผู้ใช้ร้านค้าที่ผ่านการยืนยันตัวตนแล้วเท่านั้น (Authenticated Merchant)
  const isMerchantAuthenticated = isMerchant && isAuthenticated;
  const navItems = isMerchant && !isMerchantAuthenticated ? [] : getNavItems(role);
  const RoleIcon = roleConfig.icon;

  // สีของปุ่มเมนูที่ Active บน Desktop (แยกตามบทบาทและฟังก์ชันงาน)
  const getActiveDesktopClass = (to: string) => {
    if (isAdmin) {
      if (to === APP_ROUTES.ADMIN_FRAUD_ALERTS) {
        return 'bg-rose-600 text-white shadow-xs';
      }
      return 'bg-slate-900 text-white shadow-xs';
    }
    if (isMerchant) {
      return 'bg-emerald-600 text-white shadow-xs';
    }
    return 'bg-brand-blue text-white shadow-xs';
  };

  return (
    <>
      {/* 1. TOP NAVBAR (Modern, Polished Desktop Header with Distinct Role Presentation) */}
      <nav
        aria-label="แถบเมนูหลัก"
        className="bg-white/95 backdrop-blur-md border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 shadow-2xs sticky top-0 z-30 font-sans transition-colors"
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-2 sm:gap-4">
          {/* Brand Logo & Role Indicator */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Link
              to={homePath}
              className="flex items-center space-x-2 sm:space-x-2.5 select-none min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-xl p-1 -m-1"
              aria-label="หน้าแรก ไทยช่วยไทยพลีส"
            >
              <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-2xl bg-gradient-to-br from-brand-blue to-blue-700 flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-sm shadow-blue-500/25 group-hover:scale-105 transition-transform">
                TP
              </div>
              <div className="min-w-0 flex flex-col">
                <span className="font-extrabold text-sm sm:text-base text-ink tracking-tight leading-none group-hover:text-brand-blue transition-colors">
                  THAI Please
                </span>
                <span className="text-[10px] sm:text-[11px] text-ink-muted mt-0.5 truncate leading-none hidden sm:block">
                  โครงการร่วมจ่าย Co-pay 60/40
                </span>
              </div>
            </Link>

            {/* Role Segmentation Badge (แสดงสถานะ Role ของผู้ใช้ปัจจุบันอย่างชัดเจน) */}
            <div className="h-5 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
            <div className="hidden sm:flex items-center shrink-0">
              {isAuthenticated ? (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs transition-colors ${roleConfig.badgeClass}`}
                >
                  <RoleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{roleConfig.portalLabel}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                  <span>บริการประชาชนทั่วไป</span>
                </span>
              )}
            </div>
          </div>

          {/* Desktop & Tablet Segmented Track Navigation — ลิงก์เฉพาะบทบาทปัจจุบัน */}
          {navItems.length > 0 && (
            <div className="hidden md:flex items-center">
              <div className="flex items-center p-1 rounded-full bg-slate-100/90 border border-slate-200/70 shadow-2xs space-x-1">
                {navItems.map(({ to, label, fullLabel, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === APP_ROUTES.HOME || to === APP_ROUTES.ADMIN_DASHBOARD}
                    className={({ isActive }) =>
                      `inline-flex items-center space-x-1.5 px-3 lg:px-3.5 py-1.5 rounded-full text-xs lg:text-[13px] font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                        isActive
                          ? getActiveDesktopClass(to)
                          : 'text-slate-600 hover:text-ink hover:bg-white/80'
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="hidden lg:inline">{fullLabel ?? label}</span>
                      <span className="lg:hidden">{label}</span>
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {/* User Session Info / Auth Action */}
          <div className="flex items-center space-x-2 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2 sm:space-x-2.5">
                {/* User Pill Card */}
                <div className="flex items-center space-x-2 py-1 px-2 sm:px-2.5 rounded-full bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-2xs shrink-0 ${roleConfig.avatarBgClass}`}
                  >
                    {user?.name ? user.name.charAt(0).toUpperCase() : role.charAt(0)}
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-bold text-ink leading-tight max-w-[100px] sm:max-w-[140px] truncate">
                      {user?.name || 'ผู้ใช้งาน'}
                    </span>
                    <span className="text-[10px] text-ink-muted leading-none hidden sm:block">
                      {roleConfig.label}
                    </span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={clearAuth}
                  className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-500 flex items-center justify-center transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.LOGIN)}
                className="h-9 px-3.5 sm:px-4 py-1.5 text-xs font-semibold rounded-full bg-brand-blue text-white hover:bg-brand-blue-hover transition shadow-sm inline-flex items-center space-x-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue active:scale-95"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>เข้าสู่ระบบ</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 2. MOBILE BOTTOM NAVIGATION BAR — แสดงเฉพาะเมนูของบทบาทปัจจุบัน (Thumb-friendly Ergonomics) */}
      {navItems.length > 1 && (
        <nav
          aria-label="แถบเมนูด้านล่างบนมือถือ"
          className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-hairline px-1 sm:px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] flex justify-around items-end shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden"
        >
          {navItems.map(({ to, label, icon: Icon, primary }) =>
            primary ? (
              <NavLink
                key={to}
                to={to}
                end={to === APP_ROUTES.HOME || to === APP_ROUTES.ADMIN_DASHBOARD}
                aria-label={label}
                className="flex flex-col items-center -mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-full"
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition transform active:scale-95 text-white ${
                        isMerchant ? 'bg-emerald-600' : 'bg-brand-blue'
                      } ${
                        isActive
                          ? isMerchant
                            ? 'shadow-emerald-500/40 ring-2 ring-emerald-600'
                            : 'shadow-blue-500/40 ring-2 ring-brand-blue'
                          : isMerchant
                          ? 'shadow-emerald-500/30'
                          : 'shadow-blue-500/30'
                      }`}
                    >
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span
                      className={`text-[10px] mt-1 ${
                        isActive
                          ? `${roleConfig.mobileActiveColor} font-bold`
                          : 'text-ink-body font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={to === APP_ROUTES.HOME || to === APP_ROUTES.ADMIN_DASHBOARD}
                aria-label={label}
                className={({ isActive }) =>
                  `flex flex-col items-center min-w-[50px] min-h-[44px] justify-center py-1 px-1 sm:px-2 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                    isActive
                      ? `${roleConfig.mobileActiveColor} font-bold`
                      : 'text-ink-muted hover:text-ink'
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">{label}</span>
              </NavLink>
            )
          )}
        </nav>
      )}
    </>
  );
};
