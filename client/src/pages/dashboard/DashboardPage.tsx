import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { CITIZEN_HOME_CARDS } from '../../components/common/navConfig';
import { useAuthStore } from '../../stores/authStore';

const registeredKey = (userId: string) => `citizen-benefits-registered:${userId}`;

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'MERCHANT') return <Navigate to={APP_ROUTES.MERCHANT_HOME} replace />;
  if (user?.role === 'ADMIN' || user?.role === 'STAFF') return <Navigate to={APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS} replace />;
  if (user?.role === 'GOVERNMENT_EXECUTIVE') return <Navigate to={APP_ROUTES.ADMIN_SOCIAL_IMPACT} replace />;

  const isRegistered = Boolean(user && localStorage.getItem(registeredKey(user.id)));
  if (!isRegistered) return <Navigate to={APP_ROUTES.CITIZEN_BENEFITS_REGISTER} replace />;

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
      </section>
    </div>
  </main>;
};
