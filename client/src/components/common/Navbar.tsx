import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../stores/authStore';
import { NAV_BY_ROLE, PUBLIC_ACTIONS, PUBLIC_NAV, resolveNavRole, ROLE_LABEL, type NavItem } from './navConfig';

const linkStyle = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center gap-2 rounded-pill px-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${isActive ? 'bg-brand-blue-light text-brand-blue' : 'text-ink-body hover:bg-surface-soft hover:text-ink'}`;

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const role = resolveNavRole(isAuthenticated ? user?.role : undefined);
  const items = role === 'PUBLIC' ? PUBLIC_NAV : NAV_BY_ROLE[role];
  const isPendingMerchant = role === 'MERCHANT' && user?.merchantApprovalStatus === 'PENDING';
  const visibleItems = isPendingMerchant ? items.filter((item) => item.to === APP_ROUTES.MERCHANT_PROFILE) : items;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setRegisterOpen(false);
    setRoleMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!accountOpen && !registerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setAccountOpen(false); setRegisterOpen(false); }
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !desktopMenuRef.current?.contains(event.target)) {
        setAccountOpen(false);
        setRegisterOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [accountOpen, registerOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const panel = panelRef.current;
    const focusable = () => panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [];
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === 'Tab') {
        const elements = Array.from(focusable());
        if (!elements.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const signOut = () => {
    clearAuth();
    setMobileOpen(false);
    navigate(APP_ROUTES.HOME, { replace: true });
  };

  const renderItem = (item: NavItem, mobile = false) => {
    const classes = mobile
      ? 'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-semibold text-ink-body hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue'
      : linkStyle;
    const Icon = item.icon;
    const content = <>{Icon && <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />}<span>{item.label}</span></>;
    if (item.href) {
      const isCurrent = location.pathname === '/' && location.hash === item.href.slice(1);
      return <a key={item.href} href={item.href} aria-current={isCurrent ? 'page' : undefined} className={mobile ? classes as string : linkStyle({ isActive: isCurrent })} onClick={() => setMobileOpen(false)}>{content}</a>;
    }
    if (item.to === APP_ROUTES.HOME) return <NavLink key={item.label} to={item.to} end className={classes}>{content}</NavLink>;
    return <NavLink key={item.to ?? item.label} to={item.to ?? APP_ROUTES.HOME} className={classes}>{content}</NavLink>;
  };

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:min-h-11 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-base focus:text-brand-blue focus:shadow-lg">ข้ามไปเนื้อหาหลัก</a>
      <header className="sticky top-0 z-40 border-b border-hairline bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-[72px] lg:px-8">
          <Link to={APP_ROUTES.HOME} className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" aria-label="THAI Please หน้าแรก">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-sm font-bold text-white">TP</span>
            <span className="min-w-0"><span className="block truncate text-base font-bold text-ink">THAI Please</span><span className="hidden truncate text-sm text-ink-muted sm:block">ไทยช่วยไทยพลัส</span></span>
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-2 lg:flex">
            {role === 'ADMIN' ? <div ref={roleMenuRef} className="relative">
              <button type="button" aria-expanded={roleMenuOpen} aria-haspopup="menu" onClick={() => setRoleMenuOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-base font-semibold text-ink-body hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">
                เมนูผู้ดูแล<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {roleMenuOpen && <div role="menu" className="absolute left-0 top-full z-50 mt-2 min-w-max rounded-2xl border border-hairline bg-white p-2 shadow-lg [&_a]:w-full [&_a]:justify-start [&_a]:whitespace-nowrap">{visibleItems.map((item) => <div role="none" key={item.to}>{renderItem(item)}</div>)}</div>}
            </div> : visibleItems.map((item) => renderItem(item))}
            {isPendingMerchant && <span className="rounded-pill border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">รอตรวจสอบ</span>}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <div ref={desktopMenuRef} className="relative">
                <button type="button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)} className="flex min-h-11 items-center gap-2 rounded-pill px-3 text-base font-semibold text-ink hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">
                  <span className="max-w-40 truncate">{user?.name || ROLE_LABEL[role]}</span><ChevronDown aria-hidden="true" className="h-4 w-4" />
                </button>
                {accountOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-2xl border border-hairline bg-white p-2 shadow-lg"><div className="px-3 py-2 text-sm text-ink-muted">{ROLE_LABEL[role]}</div><button type="button" role="menuitem" onClick={signOut} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-base font-semibold text-status-error hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"><LogOut aria-hidden="true" className="h-5 w-5" />ออกจากระบบ</button></div>}
              </div>
            ) : <><div ref={desktopMenuRef} className="relative"><button type="button" aria-expanded={registerOpen} aria-haspopup="menu" onClick={() => setRegisterOpen((open) => !open)} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-brand-blue px-4 text-base font-semibold text-brand-blue hover:bg-brand-blue-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.register.label}<ChevronDown aria-hidden="true" className="h-4 w-4" /></button>{registerOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-2xl border border-hairline bg-white p-2 shadow-lg"><Link role="menuitem" to={PUBLIC_ACTIONS.citizenRegister.to} className="flex min-h-11 items-center rounded-xl px-3 text-base text-ink hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.citizenRegister.label}</Link><Link role="menuitem" to={PUBLIC_ACTIONS.merchantRegister.to} className="flex min-h-11 items-center rounded-xl px-3 text-base text-ink hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.merchantRegister.label}</Link></div>}</div><Link to={PUBLIC_ACTIONS.login.to} className="inline-flex min-h-11 items-center rounded-pill bg-brand-blue px-5 text-base font-semibold text-white hover:bg-brand-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.login.label}</Link></>}
          </div>

          <button ref={menuButtonRef} type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue lg:hidden" aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={mobileOpen} aria-controls="mobile-main-menu" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden" onPointerDown={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
        <div ref={panelRef} id="mobile-main-menu" role="dialog" aria-modal="true" aria-label="เมนูหลัก" className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto border-b border-hairline bg-white p-4 shadow-xl">
          <div className="mb-3 flex min-h-12 items-center justify-between"><span className="text-lg font-bold text-ink">เมนูหลัก</span><button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" aria-label="ปิดเมนู" onClick={() => { setMobileOpen(false); menuButtonRef.current?.focus(); }}><X aria-hidden="true" className="h-5 w-5" /></button></div>
          <nav aria-label="เมนูหลัก" className="flex flex-col gap-2">{visibleItems.map((item) => renderItem(item, true))}</nav>
          {isPendingMerchant && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900">สถานะร้านค้า: รอตรวจสอบ</p>}
          {isAuthenticated ? <div className="mt-3 border-t border-hairline pt-3"><p className="px-4 py-2 text-base font-semibold text-ink">{user?.name || ROLE_LABEL[role]}</p><button type="button" onClick={signOut} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-semibold text-status-error hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"><LogOut aria-hidden="true" className="h-5 w-5" />ออกจากระบบ</button></div> : <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3"><button type="button" aria-expanded={registerOpen} aria-controls="mobile-register-options" onClick={() => setRegisterOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-pill border border-brand-blue text-base font-semibold text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.register.label}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${registerOpen ? 'rotate-180' : ''}`} /></button>{registerOpen && <div id="mobile-register-options" className="grid grid-cols-2 gap-2"><Link to={PUBLIC_ACTIONS.citizenRegister.to} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl bg-brand-blue-light px-2 text-center text-base font-semibold text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.citizenRegister.label}</Link><Link to={PUBLIC_ACTIONS.merchantRegister.to} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center justify-center rounded-xl bg-brand-blue-light px-2 text-center text-base font-semibold text-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.merchantRegister.label}</Link></div>}<Link to={PUBLIC_ACTIONS.login.to} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center justify-center rounded-pill bg-brand-blue text-base font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">{PUBLIC_ACTIONS.login.label}</Link></div>}
        </div>
      </div>}
    </>
  );
};
