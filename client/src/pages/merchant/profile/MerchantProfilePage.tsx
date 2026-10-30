import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Save,
  Store,
  Edit3,
  X,
  Mail,
  Phone,
  ExternalLink,
  Building2,
  QrCode,
  TrendingUp,
  Star,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { MerchantLocationPicker } from '../../../components/common/MerchantLocationPicker';
import { ThaiAddressSelect, ThaiAddressValue } from '../../../components/common/ThaiAddressSelect';
import { MerchantStoreOnboarding } from '../../../components/merchant/MerchantStoreOnboarding';
import { APP_ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../stores/authStore';
import {
  getOwnMerchantProfile,
  getStaffMerchantProfile,
  MerchantProfile,
  MerchantProfileInput,
  updateOwnMerchantProfile,
  updateStaffMerchantProfile,
} from '../../../services/merchantProfileApi';

type ProfileForm = MerchantProfileInput;

const errorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้';
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};

const formFromProfile = (profile: MerchantProfile, usePendingLocation: boolean): ProfileForm => ({
  businessName: profile.businessName,
  contactName: profile.contactName,
  email: profile.email,
  phone: profile.phone,
  address: profile.address,
  latitude: usePendingLocation ? profile.pendingLocation?.latitude ?? profile.latitude : profile.latitude,
  longitude: usePendingLocation ? profile.pendingLocation?.longitude ?? profile.longitude : profile.longitude,
});

export const MerchantProfilePage: React.FC = () => {
  const { merchantId } = useParams<{ merchantId: string }>();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);
  const isStaff = user?.role === 'ADMIN' || user?.role === 'STAFF';
  const queryClient = useQueryClient();

  // สถานะการแก้ไข (โหมดดูข้อมูลร้านค้าเป็นหลัก / โหมดแก้ไขเมื่อกดปุ่ม)
  const [isEditing, setIsEditing] = useState<boolean>(isStaff);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addressSelection, setAddressSelection] = useState<ThaiAddressValue | null>(null);

  const queryKey = isStaff ? ['staff-merchant-profile', merchantId] : ['own-merchant-profile'];
  const profileQuery = useQuery({
    queryKey,
    queryFn: () => isStaff && merchantId
      ? getStaffMerchantProfile(merchantId)
      : getOwnMerchantProfile(),
    enabled: !isStaff || Boolean(merchantId),
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(formFromProfile(profileQuery.data, !isStaff));
    }
  }, [profileQuery.data, isStaff]);

  const updateMutation = useMutation({
    mutationFn: (input: ProfileForm) => isStaff && merchantId
      ? updateStaffMerchantProfile(merchantId, input)
      : updateOwnMerchantProfile(input),
    onSuccess: async (profile) => {
      setForm(formFromProfile(profile, !isStaff));
      if (!isStaff && user && token) {
        setAuth({ ...user, name: profile.businessName, email: profile.email }, token);
      }
      setFeedback(isStaff
        ? 'บันทึกข้อมูลและพิกัดร้านค้าเรียบร้อยแล้ว'
        : profile.pendingLocation
          ? 'บันทึกข้อมูลพื้นฐานแล้ว พิกัดใหม่ส่งให้เจ้าหน้าที่ตรวจสอบ'
          : 'บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว');
      
      // เมื่อบันทึกสำเร็จ หากไม่ใช่เจ้าหน้าที่ ให้สลับกลับสู่โหมดดูข้อมูลร้านค้า
      if (!isStaff) {
        setIsEditing(false);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['approved-merchants'] }),
        queryClient.invalidateQueries({ queryKey: ['merchant-location-change-requests'] }),
      ]);
    },
  });

  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setFeedback(null);
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const applyAddressSelection = (selected: ThaiAddressValue) => {
    setAddressSelection(selected);
    if (selected.subdistrictCode) {
      setField(
        'address',
        `${selected.subdistrictName} ${selected.districtName} ${selected.provinceName}${
          selected.postalCode ? ` ${selected.postalCode}` : ''
        }`
      );
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    if (addressSelection && !addressSelection.subdistrictCode) {
      setFeedback('กรุณาเลือกจังหวัด อำเภอ/เขต และตำบล/แขวงให้ครบ หรือยกเลิกการเลือกพื้นที่');
      return;
    }
    if (form) updateMutation.mutate(form);
  };

  const profile = profileQuery.data;
  const mapCoordinates = form ? `${form.latitude},${form.longitude}` : profile ? `${profile.latitude},${profile.longitude}` : '';
  const mapUrl = mapCoordinates ? `https://www.google.com/maps/search/?api=1&query=${mapCoordinates}` : '';

  if (!isStaff && user?.role === 'MERCHANT' && user.merchantApprovalStatus === 'PENDING') {
    return (
      <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-10 font-sans text-ink">
        <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <h1 className="text-xl font-bold">ร้านค้าของคุณอยู่ระหว่างตรวจสอบ</h1>
          <p className="mt-2 text-base leading-relaxed">
            เมื่อเจ้าหน้าที่อนุมัติแล้ว คุณจะสามารถดูและจัดการข้อมูลหน้าร้านได้ที่หน้านี้
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-28 md:pb-14 font-sans text-ink">
      {/* ================= 1. PAGE TITLE & BREADCRUMB HEADER ================= */}
      <header className="border-b border-hairline bg-white px-3.5 sm:px-6 py-4 shadow-2xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate">
                {isStaff ? 'แก้ไขข้อมูลร้านค้า' : isEditing ? 'แก้ไขข้อมูลร้านค้า' : 'ข้อมูลร้านค้าของฉัน'}
              </h1>
              <p className="text-xs text-ink-muted truncate">
                {isStaff
                  ? 'การเปลี่ยนแปลงจากเจ้าหน้าที่มีผลทันทีและบันทึกประวัติ'
                  : isEditing
                  ? 'แก้ไขข้อมูลทั่วไปและขอเปลี่ยนพิกัดตำแหน่งร้านค้า'
                  : 'รายละเอียดร้านค้า พิกัดที่ตั้ง และการรับชำระเงิน Co-pay 60/40'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {!isStaff && profile && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white px-3.5 sm:px-4 py-1.5 text-xs font-semibold shadow-xs transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>แก้ไขข้อมูล</span>
              </button>
            )}

            {!isStaff && isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  if (profile) setForm(formFromProfile(profile, true));
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-soft hover:bg-slate-200 text-ink px-3 sm:px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>ยกเลิก</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-3.5 sm:px-6 pt-4 sm:pt-6">
        {/* Navigation Breadcrumb Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to={isStaff ? APP_ROUTES.ADMIN_MERCHANTS : APP_ROUTES.MERCHANT_HOME}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isStaff ? 'กลับไปรายชื่อร้านค้า' : 'กลับหน้าแรกของร้านค้า'}</span>
          </Link>

          {!isStaff && !isEditing && (
            <span className="text-xs text-ink-muted">โหมดแสดงข้อมูล</span>
          )}
          {isEditing && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              โหมดแก้ไขข้อมูล
            </span>
          )}
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Loading & Error States */}
        {profileQuery.isLoading ? (
          <div className="rounded-3xl border border-hairline bg-white p-8 text-center text-sm text-ink-muted">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent mb-3" />
            กำลังโหลดข้อมูลร้านค้า…
          </div>
        ) : profileQuery.error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-status-error">
            {errorMessage(profileQuery.error)}
          </div>
        ) : profile && form ? (
          <>
            {/* ================= 2. VIEW MODE (โหมดดูข้อมูลร้านค้า — หน้าตาเป็นระเบียบ อ่านง่าย ไม่ใช่ฟอร์ม) ================= */}
            {!isEditing && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* 2.1 Hero Profile Showcase Card */}
                <section className="relative overflow-hidden rounded-3xl border border-hairline bg-white p-5 sm:p-7 shadow-2xs">
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-brand-blue" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-1">
                    <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
                      <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                        <Store className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/80">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            ร้านค้าได้รับการอนุมัติ Co-pay 60/40
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-ink tracking-tight break-words">
                          {profile.businessName}
                        </h2>
                        <p className="text-xs sm:text-sm text-ink-muted">
                          ผู้ติดต่อหลัก: <span className="font-semibold text-ink">{profile.contactName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold shadow-xs transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                        <span>แก้ไขข้อมูลร้านค้า</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* 2.2 Onboarding Checklist Integration */}
                {!isStaff && (
                  <MerchantStoreOnboarding merchantId={profile.merchantId} />
                )}

                {/* 2.3 Two-Column Detail Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card A: ข้อมูลติดต่อและนิติบุคคล */}
                  <section className="rounded-3xl border border-hairline bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-hairline pb-3">
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-brand-blue" aria-hidden="true" />
                        ข้อมูลธุรกิจและช่องทางติดต่อ
                      </h3>
                    </div>

                    <dl className="space-y-3.5 text-sm">
                      <div>
                        <dt className="text-xs text-ink-muted">เลขประจำตัวผู้เสียภาษี (Tax ID)</dt>
                        <dd className="font-mono font-bold text-ink mt-0.5 tracking-wider">
                          {profile.taxId}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-ink-muted">อีเมลเข้าสู่ระบบ</dt>
                        <dd className="font-semibold text-ink mt-0.5 flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-ink-muted shrink-0" aria-hidden="true" />
                          <span className="truncate">{profile.email}</span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-ink-muted">เบอร์โทรศัพท์</dt>
                        <dd className="font-semibold text-ink mt-0.5 flex items-center gap-1.5">
                          <Phone className="h-4 w-4 text-ink-muted shrink-0" aria-hidden="true" />
                          <span className="tabular-nums">{profile.phone}</span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-ink-muted">ที่อยู่หน้าร้าน / สำหรับจัดส่ง</dt>
                        <dd className="text-xs sm:text-sm text-ink mt-1 leading-relaxed bg-surface-soft p-3 rounded-2xl border border-hairline/80">
                          {profile.address}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* Card B: ตำแหน่งร้านและพิกัดแผนที่ */}
                  <section className="rounded-3xl border border-hairline bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-hairline pb-3">
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        ตำแหน่งและพิกัดที่ตั้งร้าน
                      </h3>
                      {mapUrl && (
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                        >
                          <span>เปิด Google Maps</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    {profile.pendingLocation && (
                      <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-amber-800">
                          <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                          มีคำขอเปลี่ยนพิกัดรอเจ้าหน้าที่ตรวจสอบ
                        </p>
                        <p className="font-mono text-amber-800/90">
                          พิกัดใหม่: {profile.pendingLocation.latitude.toFixed(6)}, {profile.pendingLocation.longitude.toFixed(6)}
                        </p>
                        <p className="text-[11px] text-amber-700">
                          ยื่นคำขอเมื่อ {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.pendingLocation.requestedAt))}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-surface-soft p-3 border border-hairline/80">
                        <p className="text-xs text-ink-muted">Latitude (ละติจูด)</p>
                        <p className="font-mono font-bold text-ink mt-0.5 tabular-nums">
                          {profile.latitude.toFixed(6)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-surface-soft p-3 border border-hairline/80">
                        <p className="text-xs text-ink-muted">Longitude (ลองจิจูด)</p>
                        <p className="font-mono font-bold text-ink mt-0.5 tabular-nums">
                          {profile.longitude.toFixed(6)}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Leaflet Map Preview (Read-only) */}
                    <div className="space-y-1">
                      <MerchantLocationPicker
                        latitude={profile.latitude}
                        longitude={profile.longitude}
                        readOnly={true}
                      />
                    </div>
                  </section>
                </div>

                {/* 2.4 Quick Service Links */}
                <section aria-label="ทางลัดด่วนร้านค้า" className="rounded-3xl border border-hairline bg-white p-5 sm:p-6 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-ink">บริการร้านค้าอื่นๆ</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Link
                      to={APP_ROUTES.MERCHANT_POS_QR}
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-hairline bg-surface-soft hover:bg-emerald-50 hover:border-emerald-200 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-2xs">
                          <QrCode className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold text-ink group-hover:text-emerald-800 truncate">
                          สร้าง QR รับเงิน
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-muted group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>

                    <Link
                      to={APP_ROUTES.MERCHANT_SALES}
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-hairline bg-surface-soft hover:bg-blue-50 hover:border-blue-200 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-brand-blue shadow-2xs">
                          <TrendingUp className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold text-ink group-hover:text-brand-blue truncate">
                          สถิติยอดขาย
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-muted group-hover:text-brand-blue transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>

                    <Link
                      to={APP_ROUTES.MERCHANT_REVIEWS}
                      className="group flex items-center justify-between p-3.5 rounded-2xl border border-hairline bg-surface-soft hover:bg-amber-50 hover:border-amber-200 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-2xs">
                          <Star className="h-4 w-4 fill-amber-500" aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold text-ink group-hover:text-amber-800 truncate">
                          รีวิวจากลูกค้า
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-muted group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 3. EDIT MODE (โหมดฟอร์มแก้ไขข้อมูล — แสดงเฉพาะเมื่อกดปุ่มแก้ไข) ================= */}
            {isEditing && (
              <form onSubmit={submit} className="space-y-5 animate-in fade-in duration-200">
                {/* 3.1 Basic Information Form */}
                <section className="space-y-4 rounded-3xl border border-hairline bg-white p-5 sm:p-7 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <div>
                      <h2 className="text-base font-bold text-ink">แก้ไขข้อมูลพื้นฐาน</h2>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        ชื่อร้าน ผู้ติดต่อ และช่องทางติดต่อจะมีผลต่อการแสดงผลในแอปทันที
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>ชื่อร้านค้า <span className="text-red-500">*</span></span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={form.businessName}
                        onChange={(event) => setField('businessName', event.target.value)}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>ผู้ติดต่อหลัก <span className="text-red-500">*</span></span>
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={form.contactName}
                        onChange={(event) => setField('contactName', event.target.value)}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>อีเมลสำหรับเข้าสู่ระบบ <span className="text-red-500">*</span></span>
                      <input
                        required
                        type="email"
                        maxLength={254}
                        value={form.email}
                        onChange={(event) => setField('email', event.target.value)}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>เบอร์โทรศัพท์ <span className="text-red-500">*</span></span>
                      <input
                        required
                        minLength={9}
                        maxLength={30}
                        value={form.phone}
                        onChange={(event) => setField('phone', event.target.value)}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <div className="space-y-1.5 text-xs font-semibold text-ink sm:col-span-2">
                      <span>เลือกพื้นที่ที่อยู่ (ตัวช่วยค้นหาอัตโนมัติ)</span>
                      <ThaiAddressSelect onChange={applyAddressSelection} />
                      <label htmlFor="merchant-profile-address" className="block mt-2">
                        ที่อยู่หน้าร้าน / สำหรับจัดส่งและติดต่อ <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="merchant-profile-address"
                        required
                        minLength={8}
                        maxLength={500}
                        rows={3}
                        value={form.address}
                        onChange={(event) => setField('address', event.target.value)}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="space-y-1.5 text-xs font-semibold text-ink sm:col-span-2">
                      <span>เลขประจำตัวผู้เสียภาษี (ไม่สามารถแก้ไขได้)</span>
                      <p className="rounded-xl border border-hairline bg-surface-soft px-3 py-2.5 font-mono text-sm font-normal text-ink-muted">
                        {profile.taxId}
                      </p>
                    </div>
                  </div>
                </section>

                {/* 3.2 Location & Map Form */}
                <section className="space-y-4 rounded-3xl border border-hairline bg-white p-5 sm:p-7 shadow-2xs">
                  <div>
                    <h2 className="text-base font-bold text-ink">พิกัดตำแหน่งร้านค้า</h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {isStaff
                        ? 'คลิกบนแผนที่เพื่อระบุพิกัดใหม่และบันทึกมีผลทันที'
                        : 'คลิกแผนที่หรือกรอกพิกัดใหม่ ระบบจะส่งคำขอให้เจ้าหน้าที่ตรวจสอบและอนุมัติ'}
                    </p>
                  </div>

                  <MerchantLocationPicker
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onChange={(latitude, longitude) => {
                      setField('latitude', latitude);
                      setField('longitude', longitude);
                    }}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>Latitude (ละติจูด) <span className="text-red-500">*</span></span>
                      <input
                        required
                        type="number"
                        min={-90}
                        max={90}
                        step="any"
                        value={form.latitude}
                        onChange={(event) => setField('latitude', Number(event.target.value))}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 font-mono text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>

                    <label className="space-y-1.5 text-xs font-semibold text-ink">
                      <span>Longitude (ลองจิจูด) <span className="text-red-500">*</span></span>
                      <input
                        required
                        type="number"
                        min={-180}
                        max={180}
                        step="any"
                        value={form.longitude}
                        onChange={(event) => setField('longitude', Number(event.target.value))}
                        className="w-full rounded-xl border border-hairline px-3 py-2.5 font-mono text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:underline"
                    >
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      <span>ตรวจพิกัดที่เลือกใน Google Maps</span>
                    </a>
                  )}

                  {!isStaff && profile.pendingLocation && (
                    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-semibold">มีคำขอเปลี่ยนพิกัดรอเจ้าหน้าที่อนุมัติอยู่แล้ว</p>
                      <p className="mt-0.5 font-mono">
                        พิกัดที่ขอ: {profile.pendingLocation.latitude.toFixed(6)}, {profile.pendingLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}
                </section>

                {/* 3.3 Form Submission & Action Buttons */}
                {updateMutation.error && (
                  <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs font-semibold text-status-error">
                    {errorMessage(updateMutation.error)}
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
                  {!isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        if (profile) setForm(formFromProfile(profile, true));
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-hairline bg-white hover:bg-surface-soft px-5 py-2.5 text-sm font-semibold text-ink transition"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span>ยกเลิก</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={updateMutation.isPending || !Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-blue hover:bg-brand-blue-hover disabled:opacity-50 text-white px-6 py-2.5 text-sm font-semibold shadow-xs transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>{updateMutation.isPending ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</span>
                  </button>
                </div>
              </form>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
};
