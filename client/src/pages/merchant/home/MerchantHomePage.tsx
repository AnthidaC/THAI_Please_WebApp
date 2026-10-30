import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Clock3,
  Store,
  QrCode,
  TrendingUp,
  Star,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../stores/authStore';
import { getMerchantHistory } from '../../../services/paymentApi';

const submittedAt = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
    : 'ยังไม่มีข้อมูลจาก API';

const formatBaht = (amount: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);

export const MerchantHomePage: React.FC = () => {
  const { user, token } = useAuthStore();

  const { data: salesData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['merchant-sales-summary'],
    queryFn: () => getMerchantHistory(),
    enabled: Boolean(
      user?.role === 'MERCHANT' &&
      user?.merchantApprovalStatus !== 'PENDING' &&
      user?.merchantApprovalStatus !== 'REJECTED'
    ),
    staleTime: 30000,
  });

  if (!user || user.role !== 'MERCHANT') {
    return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  }

  const isMock = Boolean(token?.startsWith('mock-'));
  const status = user.merchantApprovalStatus;

  // 1. กรณีอยู่ระหว่างการตรวจสอบคำขอสมัครร้านค้า
  if (status === 'PENDING') {
    return (
      <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
        <section
          role="status"
          className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-amber-300 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock3 aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold">อยู่ระหว่างตรวจสอบคำขอ</h1>
              <p className="mt-2 text-base text-ink-muted">
                เมื่อเจ้าหน้าที่ตรวจสอบเสร็จแล้ว จะแสดงสถานะใหม่ที่หน้านี้
              </p>
            </div>
          </div>
          <dl className="grid gap-3 rounded-xl bg-surface-soft p-4 text-base sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">ชื่อร้าน/บัญชีผู้สมัคร</dt>
              <dd className="font-semibold">{user.name || 'ไม่มีข้อมูล'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">อีเมล</dt>
              <dd className="font-semibold">{user.email || 'ไม่มีข้อมูล'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">วันที่ส่งคำขอ</dt>
              <dd className="font-semibold">{submittedAt(user.merchantApplicationSubmittedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">สถานะเอกสาร</dt>
              <dd className="font-semibold text-amber-700">รอเจ้าหน้าที่ตรวจสอบเอกสาร</dd>
            </div>
          </dl>
          {isMock && (
            <span className="inline-flex rounded-pill bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
              ข้อมูลตัวอย่าง
            </span>
          )}
        </section>
      </main>
    );
  }

  // 2. กรณีคำขอถูกปฏิเสธ
  if (status === 'REJECTED') {
    return (
      <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
        <section className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-ink">คำขอสมัครร้านค้าไม่ผ่านการอนุมัติ</h1>
          <p className="text-base text-ink-muted">
            {user.merchantRejectionReason || 'ไม่มีเหตุผลเพิ่มเติมจากระบบ'}
          </p>
          <div className="pt-2">
            <Link
              to={APP_ROUTES.MERCHANT_REGISTER}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-brand-blue px-5 text-base font-semibold text-white hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            >
              สมัครใหม่ <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // 3. กรณีร้านค้าได้รับอนุมัติพร้อมเปิดใช้งาน (Approved Merchant Dashboard)
  const totalRevenue = salesData?.summary?.totalRevenue ?? 0;
  const totalTxCount = salesData?.summary?.totalTransactions ?? 0;
  const avgRating = salesData?.merchant?.averageRatingStars ?? 5.0;

  return (
    <main className="min-h-[75vh] bg-surface-soft px-3.5 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-28 md:pb-12 font-sans text-ink">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Banner ส่วนหัวต้อนรับร้านค้า */}
        <section className="rounded-3xl border border-hairline bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 sm:p-7 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ร้านค้าได้รับการอนุมัติแล้ว
                </span>
                <span className="text-xs text-ink-muted hidden xs:inline">
                  โครงการ Co-pay 60/40
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
                ยินดีต้อนรับ {user.name || 'ร้านค้าสมาชิก'}
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted">
                ศูนย์จัดการร้านค้า สร้าง QR รับชำระเงิน ติดตามสถิติยอดขาย และจัดการโปรไฟล์ร้านค้า
              </p>
            </div>

            <div className="shrink-0">
              <Link
                to={APP_ROUTES.MERCHANT_POS_QR}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>เปิดหน้ารับเงินด่วน</span>
              </Link>
            </div>
          </div>
        </section>

        {/* สรุปสถิติเบื้องต้น (Summary Quick Stats) */}
        <section aria-label="สรุปสถิติเบื้องต้น" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* การ์ดยอดขายรวม */}
          <div className="rounded-2xl border border-hairline bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">ยอดขายสะสมทั้งหมด</p>
              <p className="text-lg sm:text-xl font-black text-ink tabular-nums mt-0.5">
                {isLoadingStats ? 'กำลังโหลด…' : formatBaht(totalRevenue)}
              </p>
            </div>
          </div>

          {/* การ์ดจำนวนรายการ */}
          <div className="rounded-2xl border border-hairline bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">ธุรกรรมสำเร็จ</p>
              <p className="text-lg sm:text-xl font-black text-ink tabular-nums mt-0.5">
                {isLoadingStats ? 'กำลังโหลด…' : `${totalTxCount.toLocaleString('th-TH')} รายการ`}
              </p>
            </div>
          </div>

          {/* การ์ดคะแนนรีวิว */}
          <div className="rounded-2xl border border-hairline bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-muted">คะแนนความพึงพอใจ</p>
              <p className="text-lg sm:text-xl font-black text-ink tabular-nums mt-0.5 flex items-center gap-1.5">
                {isLoadingStats ? (
                  'กำลังโหลด…'
                ) : (
                  <>
                    <span>{avgRating.toFixed(1)}</span>
                    <span className="text-xs font-normal text-ink-muted">/ 5.0</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>


        {/* แผงทางลัดเข้าสู่หน้าต่าง ๆ (Quick Action Hub: 4 Core Modules) */}
        <section aria-labelledby="quick-actions-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="quick-actions-heading" className="text-base font-bold text-ink">
              เมนูจัดการร้านค้า
            </h2>
            <span className="text-xs text-ink-muted">เลือกหน้าเพื่อเริ่มดำเนินการ</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. ทางลัดหน้า POS QR */}
            <Link
              to={APP_ROUTES.MERCHANT_POS_QR}
              className="group flex min-h-[96px] items-center justify-between gap-3 rounded-2xl bg-emerald-600 p-5 text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white group-hover:scale-105 transition-transform">
                  <QrCode aria-hidden="true" className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <span className="block text-base sm:text-lg font-bold tracking-tight">
                    สร้าง QR รับชำระเงิน (POS)
                  </span>
                  <span className="mt-0.5 block text-xs sm:text-sm text-emerald-100 truncate">
                    ตั้งยอดและเปิดรับเงิน Co-pay 60/40 แบบเรียลไทม์
                  </span>
                </div>
              </div>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* 2. ทางลัดหน้าประวัติและสถิติยอดขาย */}
            <Link
              to={APP_ROUTES.MERCHANT_SALES}
              className="group flex min-h-[96px] items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-2xs transition hover:border-brand-blue hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue group-hover:scale-105 transition-transform">
                  <TrendingUp aria-hidden="true" className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <span className="block text-base sm:text-lg font-bold text-ink tracking-tight group-hover:text-brand-blue transition-colors">
                    สถิติยอดขายและประวัติเงินเข้า
                  </span>
                  <span className="mt-0.5 block text-xs sm:text-sm text-ink-muted truncate">
                    ดูสรุปรายได้ รายการรัฐสมทบ และประวัติการทำรายการ
                  </span>
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
            </Link>

            {/* 3. ทางลัดหน้ารีวิวจากลูกค้า */}
            <Link
              to={APP_ROUTES.MERCHANT_REVIEWS}
              className="group flex min-h-[96px] items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-2xs transition hover:border-amber-400 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                  <Star aria-hidden="true" className="h-6 w-6 fill-amber-500" />
                </div>
                <div className="min-w-0">
                  <span className="block text-base sm:text-lg font-bold text-ink tracking-tight group-hover:text-amber-700 transition-colors">
                    รีวิวและความคิดเห็นลูกค้า
                  </span>
                  <span className="mt-0.5 block text-xs sm:text-sm text-ink-muted truncate">
                    ดูคะแนนความพึงพอใจและข้อเสนอแนะจากผู้ใช้สิทธิ์
                  </span>
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
            </Link>

            {/* 4. ทางลัดหน้าข้อมูลร้านค้าและหมุดพิกัด */}
            <Link
              to={APP_ROUTES.MERCHANT_PROFILE}
              className="group flex min-h-[96px] items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-2xs transition hover:border-brand-blue hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:scale-105 transition-transform">
                  <Store aria-hidden="true" className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <span className="block text-base sm:text-lg font-bold text-ink tracking-tight group-hover:text-brand-blue transition-colors">
                    ข้อมูลร้านค้าและหมุดพิกัด
                  </span>
                  <span className="mt-0.5 block text-xs sm:text-sm text-ink-muted truncate">
                    แก้ไขชื่อร้าน ที่อยู่ รูปภาพ และปักหมุด GPS ที่ตั้งร้าน
                  </span>
                </div>
              </div>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-muted group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
};
