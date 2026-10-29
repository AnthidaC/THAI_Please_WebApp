import React, { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Save, Store } from 'lucide-react';
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
    if (profileQuery.data) setForm(formFromProfile(profileQuery.data, !isStaff));
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
      setField('address', `${selected.subdistrictName} ${selected.districtName} ${selected.provinceName}${selected.postalCode ? ` ${selected.postalCode}` : ''}`);
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
  const mapUrl = form
    ? `https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`
    : '';

  if (!isStaff && user?.role === 'MERCHANT' && user.merchantApprovalStatus === 'PENDING') {
    return <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-10 font-sans text-ink">
      <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-xl font-bold">ร้านค้าของคุณอยู่ระหว่างตรวจสอบ</h1>
        <p className="mt-2 text-base leading-relaxed">เมื่อเจ้าหน้าที่อนุมัติแล้ว คุณจะกลับมาเติมรูปและข้อมูลหน้าร้านได้ที่หน้านี้</p>
      </section>
    </main>;
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      <header className="border-b border-hairline bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold sm:text-lg">{isStaff ? 'แก้ไขข้อมูลร้านค้า' : 'ข้อมูลร้านค้าของฉัน'}</h1>
            <p className="text-xs text-ink-muted">
              {isStaff ? 'การเปลี่ยนแปลงจากเจ้าหน้าที่มีผลทันทีและบันทึกประวัติ' : 'ข้อมูลพื้นฐานแก้ไขได้ทันที ส่วนพิกัดใหม่ต้องรออนุมัติ'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        {!isStaff && user?.role === 'MERCHANT' && <MerchantStoreOnboarding merchantId={profile?.merchantId ?? user.id} />}
        <Link
          to={isStaff ? APP_ROUTES.ADMIN_MERCHANTS : APP_ROUTES.MERCHANT_POS_QR}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {isStaff ? 'กลับไปรายชื่อร้านค้า' : 'กลับหน้าร้านค้า'}
        </Link>

        {profileQuery.isLoading ? (
          <p className="rounded-2xl border border-hairline bg-white p-6 text-sm text-ink-muted">กำลังโหลดข้อมูลร้านค้า...</p>
        ) : profileQuery.error ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-status-error">
            {errorMessage(profileQuery.error)}
          </p>
        ) : profile && form ? (
          <form onSubmit={submit} className="space-y-5">
            <section className="space-y-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-6">
              <div>
                <h2 className="text-sm font-bold">ข้อมูลพื้นฐาน</h2>
                <p className="mt-1 text-xs text-ink-muted">เลขประจำตัวผู้เสียภาษีไม่สามารถแก้ไขผ่านหน้านี้ได้</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-semibold">
                  ชื่อร้านค้า
                  <input required minLength={2} maxLength={100} value={form.businessName}
                    onChange={(event) => setField('businessName', event.target.value)}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  ผู้ติดต่อ
                  <input required minLength={2} maxLength={100} value={form.contactName}
                    onChange={(event) => setField('contactName', event.target.value)}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  อีเมลสำหรับเข้าสู่ระบบ
                  <input required type="email" maxLength={254} value={form.email}
                    onChange={(event) => setField('email', event.target.value)}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  เบอร์โทรศัพท์
                  <input required minLength={9} maxLength={30} value={form.phone}
                    onChange={(event) => setField('phone', event.target.value)}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <div className="space-y-1.5 text-xs font-semibold sm:col-span-2">
                  ที่อยู่ร้าน
                  <ThaiAddressSelect onChange={applyAddressSelection} />
                  <label htmlFor="merchant-profile-address" className="block">ที่อยู่สำหรับจัดส่ง/ติดต่อ</label>
                  <textarea id="merchant-profile-address" required minLength={8} maxLength={500} rows={3} value={form.address}
                    onChange={(event) => setField('address', event.target.value)}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="space-y-1.5 text-xs font-semibold">
                  เลขประจำตัวผู้เสียภาษี
                  <p className="rounded-xl border border-hairline bg-surface-soft px-3 py-2.5 text-sm font-normal">{profile.taxId}</p>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-6">
              <div>
                <h2 className="text-sm font-bold">พิกัดร้านค้า</h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {isStaff ? 'เลือกพิกัดใหม่บนแผนที่เพื่อบันทึกทันที' : 'คลิกแผนที่หรือกรอกพิกัดใหม่ ระบบจะใช้พิกัดเดิมจนกว่าเจ้าหน้าที่จะอนุมัติ'}
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
                <label className="space-y-1.5 text-xs font-semibold">
                  Latitude
                  <input required type="number" min={-90} max={90} step="any" value={form.latitude}
                    onChange={(event) => setField('latitude', Number(event.target.value))}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 font-mono text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="space-y-1.5 text-xs font-semibold">
                  Longitude
                  <input required type="number" min={-180} max={180} step="any" value={form.longitude}
                    onChange={(event) => setField('longitude', Number(event.target.value))}
                    className="w-full rounded-xl border border-hairline px-3 py-2.5 font-mono text-sm font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                <MapPin className="h-4 w-4" /> ตรวจตำแหน่งใน Google Maps
              </a>
              {!isStaff && profile.pendingLocation && (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">มีคำขอเปลี่ยนพิกัดรอเจ้าหน้าที่อนุมัติ</p>
                  <p className="mt-1">พิกัดที่ขอ: {profile.pendingLocation.latitude.toFixed(6)}, {profile.pendingLocation.longitude.toFixed(6)}</p>
                </div>
              )}
            </section>

            {feedback && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> {feedback}
              </p>
            )}
            {updateMutation.error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-status-error">{errorMessage(updateMutation.error)}</p>
            )}
            <button
              type="submit"
              disabled={updateMutation.isPending || !Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-brand-blue px-5 py-3 text-sm font-semibold text-white hover:bg-brand-blue-hover disabled:opacity-50 sm:w-auto"
            >
              <Save className="h-4 w-4" /> {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </form>
        ) : null}
      </main>
    </div>
  );
};
