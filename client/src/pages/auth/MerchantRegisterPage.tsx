import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ArrowLeft, CheckCircle2, FileText, MapPin, Store, Upload, UserRound } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { ThaiAddressSelect, ThaiAddressValue } from '../../components/common/ThaiAddressSelect';
import { MerchantLocationPicker } from '../../components/common/MerchantLocationPicker';
import { submitMerchantApplication, getIpLocation } from '../../services/merchantApplicationApi';
import provinceCentersData from '../../data/thai-address/province-centers.json';

type ProvinceCenter = { pro_code: string; pro_th: string; pro_en: string; lat: number; lng: number };
const provinceCenters = provinceCentersData as Record<string, ProvinceCenter>;

type BusinessType = 'INDIVIDUAL' | 'JURISTIC';
type DocumentKey = 'storePhoto' | 'bankProof' | 'businessRegistration' | 'companyCertificate' | 'authorization';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

// FEATURE FLAG: ควบคุมการบังคับอัปโหลดเอกสารร้านค้า
// Default = true (บังคับเอกสาร) ยกเว้นกำหนด VITE_MERCHANT_REQUIRE_DOCUMENTS=false ชัดเจนใน .env
const REQUIRE_DOCUMENTS = import.meta.env.VITE_MERCHANT_REQUIRE_DOCUMENTS !== 'false';

// Default Bangkok fallback if no province or IP yet
const DEFAULT_FALLBACK_COORDS = { lat: 13.7563, lng: 100.5018 };

export const MerchantRegisterPage: React.FC = () => {
  const [businessType, setBusinessType] = useState<BusinessType>('INDIVIDUAL');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');

  // Location & Map State
  const [latitude, setLatitude] = useState<number>(DEFAULT_FALLBACK_COORDS.lat);
  const [longitude, setLongitude] = useState<number>(DEFAULT_FALLBACK_COORDS.lng);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [isApproximate, setIsApproximate] = useState(true);
  const [approximateSource, setApproximateSource] = useState<'IP' | 'PROVINCE' | null>('IP');
  const [isLocating, setIsLocating] = useState(false);

  // Track if user explicitly placed pin (GPS / Click / Drag) so selecting province won't overwrite it
  const isUserPinnedRef = useRef(false);

  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [addressSelection, setAddressSelection] = useState<ThaiAddressValue | null>(null);

  // 1. Initial Location Strategy: Try GPS first (if supported), else fallback to Server IP Location
  useEffect(() => {
    let active = true;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active || isUserPinnedRef.current) return;
          setLatitude(Number(position.coords.latitude.toFixed(6)));
          setLongitude(Number(position.coords.longitude.toFixed(6)));
          setIsLocationConfirmed(true);
          setIsApproximate(false);
          setApproximateSource(null);
          isUserPinnedRef.current = true;
        },
        () => {
          // Geolocation denied or unavailable -> Fallback to server IP lookup
          if (!active || isUserPinnedRef.current) return;
          void getIpLocation().then((ipData) => {
            if (!active || isUserPinnedRef.current) return;
            if (ipData?.latitude && ipData?.longitude) {
              setLatitude(Number(ipData.latitude.toFixed(6)));
              setLongitude(Number(ipData.longitude.toFixed(6)));
              setIsApproximate(true);
              setApproximateSource('IP');
              setIsLocationConfirmed(false);
            }
          });
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      void getIpLocation().then((ipData) => {
        if (!active || isUserPinnedRef.current) return;
        if (ipData?.latitude && ipData?.longitude) {
          setLatitude(Number(ipData.latitude.toFixed(6)));
          setLongitude(Number(ipData.longitude.toFixed(6)));
          setIsApproximate(true);
          setApproximateSource('IP');
          setIsLocationConfirmed(false);
        }
      });
    }

    return () => {
      active = false;
    };
  }, []);

  // Request Current Location manually (Button trigger)
  const handleLocateUser = () => {
    if (!('geolocation' in navigator)) {
      setErrorMessage('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setIsLocationConfirmed(true);
        setIsApproximate(false);
        setApproximateSource(null);
        isUserPinnedRef.current = true;
      },
      () => {
        setIsLocating(false);
        setErrorMessage('ไม่สามารถเข้าถึงตำแหน่ง GPS ของอุปกรณ์ได้ กรุณาแตะบนแผนที่เพื่อเลือกตำแหน่ง');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Callback when user drags or clicks marker on map
  const handleLocationChange = (newLat: number, newLng: number, userConfirmed: boolean) => {
    setLatitude(newLat);
    setLongitude(newLng);
    if (userConfirmed) {
      setIsLocationConfirmed(true);
      setIsApproximate(false);
      setApproximateSource(null);
      isUserPinnedRef.current = true;
    }
  };

  // Address selection handler: If user hasn't confirmed a pin with GPS/Click/Drag, move pin to province center
  const applyAddressSelection = (selected: ThaiAddressValue) => {
    setAddressSelection(selected);
    if (!selected.subdistrictCode) return;
    setAddress(`${selected.subdistrictName} ${selected.districtName} ${selected.provinceName}${selected.postalCode ? ` ${selected.postalCode}` : ''}`);

    // If user has NOT manually confirmed or pinned via GPS, move marker to province center
    if (!isUserPinnedRef.current && selected.provinceCode) {
      const targetCode = String(selected.provinceCode).padStart(2, '0');
      const center = provinceCenters[targetCode];

      if (center?.lat && center?.lng) {
        setLatitude(Number(Number(center.lat).toFixed(6)));
        setLongitude(Number(Number(center.lng).toFixed(6)));
        setIsApproximate(true);
        setApproximateSource('PROVINCE');
        setIsLocationConfirmed(false);
      }
    }
  };

  const selectDocument = (key: DocumentKey, file?: File) => {
    setErrorMessage(null);
    if (!file) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setErrorMessage('รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setErrorMessage('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
      return;
    }
    setDocuments((current) => ({ ...current, [key]: file }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingCommonDocuments = REQUIRE_DOCUMENTS && (!documents.storePhoto || !documents.bankProof);
    const missingCompanyCertificate = REQUIRE_DOCUMENTS && businessType === 'JURISTIC' && !documents.companyCertificate;

    if (!isLocationConfirmed) {
      setErrorMessage('กรุณาแตะบนแผนที่ หรือลากหมุดเพื่อยืนยันตำแหน่งจริงของร้านค้าก่อนส่งคำขอ');
      return;
    }

    if (missingCommonDocuments || missingCompanyCertificate || !taxId.match(/^\d{13}$/) || !addressSelection?.subdistrictCode) {
      setErrorMessage(!addressSelection?.subdistrictCode
        ? 'กรุณาเลือกจังหวัด อำเภอ/เขต และตำบล/แขวงให้ครบ'
        : !taxId.match(/^\d{13}$/)
          ? 'กรุณากรอกเลขประจำตัว 13 หลัก'
          : 'กรุณาแนบรูปหน้าร้านและหลักฐานบัญชีธนาคาร' +
          (missingCompanyCertificate ? ' รวมถึงหนังสือรับรองนิติบุคคล' : ''));
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('businessType', businessType);
    formData.append('taxId', taxId);
    formData.append('businessName', businessName);
    formData.append('contactName', contactName);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('password', password);
    formData.append('address', address);
    formData.append('latitude', String(latitude));
    formData.append('longitude', String(longitude));
    Object.entries(documents).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    try {
      const result = await submitMerchantApplication(formData);
      setApplicationId(result.applicationId);
      setPassword('');
      setDocuments({});
      setIsSubmitted(true);
    } catch (error) {
      const data = isAxiosError<{ message?: string; errors?: Array<{ field: string; message: string }> }>(error)
        ? error.response?.data
        : undefined;
      const message = data?.errors?.map((e) => e.message).join(', ') || data?.message;
      setErrorMessage(message || 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const documentField = (key: DocumentKey, label: string, required = false, hint?: string) => (
    <label className="block rounded-xl border border-hairline bg-white p-3">
      <span className="flex items-start gap-2 text-xs font-semibold text-ink">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
        <span>
          {label}{required ? ' *' : ' (ถ้ามี)'}
          {hint && <span className="mt-1 block font-normal text-ink-muted">{hint}</span>}
        </span>
      </span>
      <span className="mt-2 flex items-center gap-2 text-[11px] text-brand-blue">
        <Upload className="h-3.5 w-3.5" />
        {documents[key]?.name ?? 'เลือกไฟล์ PDF, JPG หรือ PNG (ไม่เกิน 10 MB)'}
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(event) => selectDocument(key, event.target.files?.[0])}
      />
    </label>
  );

  if (isSubmitted) {
    return (
      <div className="space-y-4 text-center font-sans">
        <CheckCircle2 className="mx-auto h-12 w-12 text-status-success" />
        <h2 className="text-xl font-bold text-ink">ส่งคำขอสมัครร้านค้าเรียบร้อย</h2>
        {applicationId && <p className="text-xs text-ink-muted">เลขที่คำขอ: {applicationId}</p>}
        <p className="text-sm leading-relaxed text-ink-muted">
          คำขออยู่ระหว่างตรวจสอบ เจ้าหน้าที่จะตรวจข้อมูลและเอกสารก่อนอนุมัติ
          คุณจะเข้าสู่ Merchant Web App ได้เมื่อได้รับอนุมัติแล้ว
        </p>
        <Link to={APP_ROUTES.MERCHANT_LOGIN} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue hover:underline">
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าเข้าสู่ระบบร้านค้า
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <Store className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-ink">สมัครเข้าร่วมสำหรับร้านค้า</h2>
        <p className="mt-1 text-xs text-ink-muted">กรอกข้อมูลกิจการและแนบหลักฐานเพื่อประกอบการตรวจสอบ</p>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-ink">ข้อมูลกิจการและผู้ติดต่อ</h3>
          <div>
            <label htmlFor="merchant-business-type" className="mb-1 block text-xs font-semibold text-ink">ประเภทร้านค้า</label>
            <select
              id="merchant-business-type"
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value === 'JURISTIC' ? 'JURISTIC' : 'INDIVIDUAL')}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="INDIVIDUAL">บุคคลธรรมดา / ร้านค้าทั่วไป</option>
              <option value="JURISTIC">นิติบุคคล</option>
            </select>
          </div>

          <div>
            <label htmlFor="merchant-business-name" className="mb-1 block text-xs font-semibold text-ink">ชื่อร้านหรือชื่อกิจการ</label>
            <input id="merchant-business-name" required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>

          <div>
            <label htmlFor="merchant-tax-id" className="mb-1 block text-xs font-semibold text-ink">เลขประจำตัว 13 หลัก</label>
            <input id="merchant-tax-id" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} required value={taxId} onChange={(event) => setTaxId(event.target.value.replace(/\D/g, '').slice(0, 13))} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-ink-muted">ใช้ตรวจสอบกิจการและป้องกันการสมัครซ้ำ</p>
          </div>

          <div>
            <label htmlFor="merchant-contact-name" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink">
              <UserRound className="h-3.5 w-3.5" /> ชื่อผู้ติดต่อ
            </label>
            <input id="merchant-contact-name" required value={contactName} onChange={(event) => setContactName(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="merchant-email" className="mb-1 block text-xs font-semibold text-ink">อีเมล</label>
              <input id="merchant-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="merchant-phone" className="mb-1 block text-xs font-semibold text-ink">เบอร์โทรศัพท์</label>
              <input id="merchant-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div>
            <label htmlFor="merchant-password" className="mb-1 block text-xs font-semibold text-ink">ตั้งรหัสผ่าน</label>
            <input id="merchant-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-ink-muted">อย่างน้อย 12 ตัวอักษร บันทึกเป็นรหัสผ่านแบบเข้ารหัส</p>
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-bold text-ink">ที่ตั้งร้านค้า</h3>
          <div>
            <ThaiAddressSelect onChange={applyAddressSelection} />
            <label htmlFor="merchant-address" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink">
              <MapPin className="h-3.5 w-3.5" /> ที่อยู่ร้าน
            </label>
            <textarea
              id="merchant-address"
              required
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์"
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
            />

            {/* แผนที่เลือกพิกัดร้านค้า (MerchantLocationPicker) */}
            <div className="mt-3">
              <MerchantLocationPicker
                latitude={latitude}
                longitude={longitude}
                onChange={handleLocationChange}
                isConfirmed={isLocationConfirmed}
                isApproximate={isApproximate}
                approximateSource={approximateSource}
                onLocateUser={handleLocateUser}
                isLocating={isLocating}
              />
            </div>
          </div>
        </section>

        {/* FEATURE FLAG: ซ่อนส่วนอัปโหลดเอกสารชั่วคราวเมื่อ REQUIRE_DOCUMENTS=false (เปิดคืนโดยตั้ง VITE_MERCHANT_REQUIRE_DOCUMENTS=true ใน .env) */}
        {REQUIRE_DOCUMENTS && (
          <section className="space-y-3 border-t border-hairline pt-4">
            <div>
              <h3 className="text-sm font-bold text-ink">เอกสารประกอบการตรวจสอบ</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                เอกสารตัวอย่างที่แนะนำ อาจต้องปรับตามหลักเกณฑ์ของโครงการและประเภทร้านค้า
              </p>
            </div>
            {documentField('storePhoto', 'รูปหน้าร้านหรือจุดขายที่เห็นชื่อร้าน', true, 'ควรเป็นภาพปัจจุบันที่ช่วยยืนยันว่ามีสถานที่ประกอบการจริง')}
            {documentField('bankProof', 'หลักฐานบัญชีธนาคารหรือ PromptPay ในนามผู้สมัคร/กิจการ', true)}
            {businessType === 'INDIVIDUAL'
              ? documentField('businessRegistration', 'ทะเบียนพาณิชย์หรือหลักฐานการประกอบกิจการ')
              : (
                <>
                  {documentField('companyCertificate', 'หนังสือรับรองนิติบุคคลฉบับล่าสุด', true)}
                  {documentField('authorization', 'เอกสารผู้มีอำนาจลงนามหรือหนังสือมอบอำนาจ')}
                </>
              )}
          </section>
        )}

        <button type="submit" disabled={isSubmitting} className="w-full rounded-pill bg-brand-blue py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-blue-hover disabled:opacity-60">
          {isSubmitting ? 'กำลังส่งข้อมูลและเอกสาร...' : 'ส่งคำขอสมัครร้านค้า'}
        </button>
      </form>

      <div className="border-t border-hairline pt-3 text-center text-xs text-ink-muted">
        มีบัญชีร้านค้าแล้ว?{' '}
        <Link to={APP_ROUTES.MERCHANT_LOGIN} className="font-semibold text-brand-blue hover:underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
};
