import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../stores/authStore';

export const CitizenBenefitsRegisterPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  if (!user) return null;
  const key = `citizen-benefits-registered:${user.id}`;
  const completeMockRegistration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localStorage.setItem(key, new Date().toISOString());
    navigate(APP_ROUTES.DASHBOARD, { replace: true });
  };
  return <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
    <form onSubmit={completeMockRegistration} className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue"><ClipboardCheck aria-hidden="true" className="h-6 w-6" /></span>
      <div><h1 className="text-2xl font-bold">ลงทะเบียนรับสิทธิ์</h1><p className="mt-2 text-base text-ink-muted">ระบบตรวจสอบสิทธิ์ยังไม่เชื่อมต่อ API หน้านี้บันทึกสถานะทดลองไว้ในอุปกรณ์นี้เท่านั้น</p></div>
      <dl className="grid gap-3 rounded-xl bg-surface-soft p-4 text-base sm:grid-cols-2"><div><dt className="text-sm text-ink-muted">ชื่อบัญชี</dt><dd className="font-semibold">{user.name || 'ผู้ใช้งาน'}</dd></div><div><dt className="text-sm text-ink-muted">อีเมล</dt><dd className="font-semibold">{user.email || 'ไม่มีข้อมูล'}</dd></div></dl>
      <div className="flex flex-wrap gap-3"><button type="submit" className="min-h-11 rounded-pill bg-brand-blue px-5 text-base font-semibold text-white hover:bg-brand-blue-hover">ยืนยันลงทะเบียน (ทดลอง)</button><Link to={APP_ROUTES.HOME} className="inline-flex min-h-11 items-center rounded-pill border border-hairline px-5 text-base font-semibold">กลับหน้าแรก</Link></div>
    </form>
  </main>;
};
