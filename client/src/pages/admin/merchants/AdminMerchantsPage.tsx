import React from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, Pencil, RefreshCw, Store } from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { getApprovedMerchants } from '../../../services/merchantProfileApi';

const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้';
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};

export const AdminMerchantsPage: React.FC = () => {
  const merchantsQuery = useQuery({
    queryKey: ['approved-merchants'],
    queryFn: getApprovedMerchants,
  });
  const merchants = merchantsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      <header className="border-b border-hairline bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue"><Store className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">จัดการข้อมูลร้านค้า</h1>
              <p className="text-xs text-ink-muted">แก้ไขข้อมูลพื้นฐานและพิกัดของร้านค้าที่ได้รับอนุมัติแล้ว</p>
            </div>
          </div>
          <button type="button" onClick={() => void merchantsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-pill border border-hairline px-3 py-2 text-xs font-semibold hover:bg-surface-soft">
            <RefreshCw className="h-4 w-4 text-brand-blue" /> รีเฟรช
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
          {merchantsQuery.isLoading ? (
            <p className="p-6 text-sm text-ink-muted">กำลังโหลดรายชื่อร้านค้า...</p>
          ) : merchantsQuery.error ? (
            <p role="alert" className="p-6 text-sm text-status-error">{getErrorMessage(merchantsQuery.error)}</p>
          ) : merchants.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-muted">ยังไม่มีร้านค้าที่ได้รับอนุมัติ</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {merchants.map((merchant) => (
                <li key={merchant.merchantId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold">{merchant.businessName}</h2>
                    <p className="mt-1 text-xs text-ink-muted">เลขผู้เสียภาษี {merchant.taxId}</p>
                    <p className="mt-1 truncate text-xs text-ink-muted">{merchant.address}</p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${merchant.latitude},${merchant.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                      <MapPin className="h-3.5 w-3.5" /> {merchant.latitude.toFixed(6)}, {merchant.longitude.toFixed(6)}
                    </a>
                  </div>
                  <Link to={`${APP_ROUTES.ADMIN_MERCHANTS}/${merchant.merchantId}/edit`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-pill border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-brand-blue hover:bg-blue-100">
                    <Pencil className="h-4 w-4" /> แก้ไขข้อมูล
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};
