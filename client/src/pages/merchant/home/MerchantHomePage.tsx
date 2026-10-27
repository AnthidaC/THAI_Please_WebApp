import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Clock3, Store } from 'lucide-react';
import { MerchantStoreOnboarding } from '../../../components/merchant/MerchantStoreOnboarding';
import { APP_ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../stores/authStore';

const submittedAt = (value?: string | null) => value
  ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
  : 'ยังไม่มีข้อมูลจาก API';

export const MerchantHomePage: React.FC = () => {
  const { user, token } = useAuthStore();
  if (!user || user.role !== 'MERCHANT') return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  const isMock = Boolean(token?.startsWith('mock-'));
  const status = user.merchantApprovalStatus;

  if (status === 'PENDING') return <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
    <section role="status" className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-amber-300 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Clock3 aria-hidden="true" className="h-6 w-6" /></span><div><h1 className="text-2xl font-bold">อยู่ระหว่างตรวจสอบ</h1><p className="mt-2 text-base text-ink-muted">เมื่อเจ้าหน้าที่ตรวจสอบเสร็จแล้ว จะแสดงสถานะใหม่ที่หน้านี้</p></div></div>
      <dl className="grid gap-3 rounded-xl bg-surface-soft p-4 text-base sm:grid-cols-2"><div><dt className="text-sm text-ink-muted">ชื่อร้าน</dt><dd className="font-semibold">{user.merchantApplicationSummary?.businessName || user.name || 'ไม่มีข้อมูลจาก API'}</dd></div><div><dt className="text-sm text-ink-muted">ผู้ติดต่อ</dt><dd className="font-semibold">{user.merchantApplicationSummary?.contactName || 'ไม่มีข้อมูลจาก API'}</dd></div><div><dt className="text-sm text-ink-muted">อีเมล / โทรศัพท์</dt><dd className="font-semibold">{[user.email, user.merchantApplicationSummary?.phone].filter(Boolean).join(' · ') || 'ไม่มีข้อมูลจาก API'}</dd></div><div><dt className="text-sm text-ink-muted">ที่อยู่ที่ส่ง</dt><dd className="font-semibold">{user.merchantApplicationSummary?.address || 'ไม่มีข้อมูลจาก API'}</dd></div><div><dt className="text-sm text-ink-muted">วันที่ส่งคำขอ</dt><dd className="font-semibold">{submittedAt(user.merchantApplicationSubmittedAt)}</dd></div></dl>
      {isMock && <span className="inline-flex rounded-pill bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">ข้อมูลตัวอย่าง</span>}
    </section>
  </main>;

  if (status === 'REJECTED') return <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6"><section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8"><h1 className="text-2xl font-bold">คำขอสมัครร้านค้าไม่ผ่านการอนุมัติ</h1><p className="text-base text-ink-muted">{user.merchantRejectionReason || 'ไม่มีเหตุผลเพิ่มเติมจากระบบ'}</p><Link to={APP_ROUTES.MERCHANT_REGISTER} className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-brand-blue px-5 text-base font-semibold text-white hover:bg-brand-blue-hover">สมัครใหม่ <ArrowRight aria-hidden="true" className="h-5 w-5" /></Link></section></main>;

  if (status !== 'APPROVED') return <main className="mx-auto max-w-3xl px-4 py-10"><section className="rounded-2xl border border-hairline bg-white p-6"><h1 className="text-xl font-bold">ยังไม่พบสถานะร้านค้า</h1><p className="mt-2 text-base text-ink-muted">ระบบยังไม่ได้ส่งสถานะอนุมัติมาให้บัญชีนี้</p></section></main>;

  return <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6"><div className="mx-auto max-w-5xl space-y-5">
    <section className="rounded-2xl border border-hairline bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-status-success">ร้านค้าได้รับอนุมัติแล้ว</p><h1 className="mt-2 text-2xl font-bold">ยินดีต้อนรับ{user.name ? ` ${user.name}` : 'เข้าสู่ระบบร้านค้า'}</h1></section>
    <MerchantStoreOnboarding merchantId={user.id} />
    <section className="grid gap-4 sm:grid-cols-2">
      <Link to={APP_ROUTES.MERCHANT_POS_QR} className="flex min-h-28 items-center justify-between gap-3 rounded-2xl bg-brand-blue p-5 text-white shadow-sm hover:bg-brand-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"><span><span className="block text-xl font-bold">สร้าง QR รับชำระเงิน</span><span className="mt-1 block text-base text-white/90">เปิดหน้ารับชำระเงินของร้านค้า</span></span><ArrowRight aria-hidden="true" className="h-6 w-6 shrink-0" /></Link>
      <Link to={APP_ROUTES.MERCHANT_PROFILE} className="flex min-h-28 items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-sm hover:border-brand-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue"><span><span className="block text-xl font-bold">ข้อมูลร้านค้าของฉัน</span><span className="mt-1 block text-base text-ink-muted">ตรวจสอบและแก้ไขข้อมูลร้านค้า</span></span><Store aria-hidden="true" className="h-6 w-6 shrink-0 text-brand-blue" /></Link>
    </section>
  </div></main>;
};
