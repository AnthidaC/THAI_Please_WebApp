import React, { useEffect, useMemo, useState } from 'react';

interface Province { provinceCode: number; provinceNameTh: string; }
interface District { provinceCode: number; districtCode: number; districtNameTh: string; }
interface Subdistrict { provinceCode: number; districtCode: number; subdistrictCode: number; subdistrictNameTh: string; postalCode?: number; }
export interface ThaiAddressValue {
  provinceCode: string;
  provinceName: string;
  districtCode: string;
  districtName: string;
  subdistrictCode: string;
  subdistrictName: string;
  postalCode: string;
}

interface Props {
  onChange: (value: ThaiAddressValue) => void;
}

const code = (value: number, length: number) => String(value).padStart(length, '0');
const filtered = <T, K extends keyof T>(items: T[], nameKey: K, query: string) =>
  query.trim() ? items.filter((item) => String(item[nameKey]).toLocaleLowerCase('th').includes(query.trim().toLocaleLowerCase('th'))) : items;

export const ThaiAddressSelect: React.FC<Props> = ({ onChange }) => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [subdistrictSearch, setSubdistrictSearch] = useState('');
  const [selectedPostalCode, setSelectedPostalCode] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [subdistrictCode, setSubdistrictCode] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      import('../../data/thai-address/provinces.json'),
      import('../../data/thai-address/districts.json'),
      import('../../data/thai-address/subdistricts.json'),
    ]).then(([provinceData, districtData, subdistrictData]) => {
      if (!active) return;
      setProvinces(provinceData.default as Province[]);
      setDistricts(districtData.default as District[]);
      setSubdistricts(subdistrictData.default as Subdistrict[]);
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedProvince = provinces.find((item) => code(item.provinceCode, 2) === provinceCode);
  const provinceDistricts = useMemo(() => districts.filter((item) => item.provinceCode === selectedProvince?.provinceCode), [districts, selectedProvince]);
  const selectedDistrict = provinceDistricts.find((item) => code(item.districtCode, 4) === districtCode);
  const districtSubdistricts = useMemo(() => subdistricts.filter((item) => item.districtCode === selectedDistrict?.districtCode), [subdistricts, selectedDistrict]);
  const shownProvinces = filtered(provinces, 'provinceNameTh', provinceSearch);
  const shownDistricts = filtered(provinceDistricts, 'districtNameTh', districtSearch);
  const shownSubdistricts = filtered(districtSubdistricts, 'subdistrictNameTh', subdistrictSearch);

  const emit = (province: Province, district: District, subdistrict: Subdistrict) => {
    const postalCode = subdistrict.postalCode ? String(subdistrict.postalCode).padStart(5, '0') : '';
    setSelectedPostalCode(postalCode);
    onChange({
      provinceCode: code(province.provinceCode, 2), provinceName: province.provinceNameTh,
      districtCode: code(district.districtCode, 4), districtName: district.districtNameTh,
      subdistrictCode: code(subdistrict.subdistrictCode, 6), subdistrictName: subdistrict.subdistrictNameTh,
      postalCode,
    });
  };

  const controlClass = 'min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue disabled:bg-surface-soft disabled:text-ink-muted';
  const searchClass = 'mb-2 min-h-11 w-full rounded-xl border border-hairline px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue';

  return <fieldset className="space-y-4 rounded-2xl border border-hairline p-4">
    <legend className="px-2 text-base font-semibold text-ink">เลือกที่อยู่ร้าน</legend>
    {isLoading && <p role="status" className="text-sm text-ink-muted">กำลังโหลดข้อมูลที่อยู่…</p>}
    {loadError && <p role="alert" className="text-sm text-status-error">โหลดข้อมูลที่อยู่ไม่สำเร็จ กรุณาลองใหม่</p>}
    <div>
      <label htmlFor="address-province-search" className="mb-1 block text-sm font-semibold text-ink">ค้นหาจังหวัด</label>
      <input id="address-province-search" className={searchClass} value={provinceSearch} onChange={(event) => setProvinceSearch(event.target.value)} placeholder="พิมพ์ชื่อจังหวัด" />
      <label htmlFor="address-province" className="sr-only">จังหวัด</label>
      <select id="address-province" className={controlClass} value={provinceCode} onChange={(event) => {
        const next = event.target.value;
        const province = provinces.find((item) => code(item.provinceCode, 2) === next);
        setProvinceCode(next); setDistrictCode(''); setSubdistrictCode('');
        setSelectedPostalCode('');
        onChange(province
          ? { provinceCode: code(province.provinceCode, 2), provinceName: province.provinceNameTh, districtCode: '', districtName: '', subdistrictCode: '', subdistrictName: '', postalCode: '' }
          : { provinceCode: '', provinceName: '', districtCode: '', districtName: '', subdistrictCode: '', subdistrictName: '', postalCode: '' });
      }}>
        <option value="">เลือกจังหวัด</option>{shownProvinces.map((item) => <option key={item.provinceCode} value={code(item.provinceCode, 2)}>{item.provinceNameTh}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="address-district-search" className="mb-1 block text-sm font-semibold text-ink">ค้นหาอำเภอ / เขต</label>
      <input id="address-district-search" className={searchClass} value={districtSearch} onChange={(event) => setDistrictSearch(event.target.value)} placeholder="พิมพ์ชื่ออำเภอหรือเขต" disabled={!provinceCode} />
      <label htmlFor="address-district" className="sr-only">อำเภอ / เขต</label>
      <select id="address-district" className={controlClass} disabled={!provinceCode} value={districtCode} onChange={(event) => {
        const next = event.target.value;
        setDistrictCode(next); setSubdistrictCode('');
        setSelectedPostalCode('');
        const district = provinceDistricts.find((item) => code(item.districtCode, 4) === next);
        setSelectedPostalCode('');
        onChange(selectedProvince && district
          ? { provinceCode, provinceName: selectedProvince.provinceNameTh, districtCode: next, districtName: district.districtNameTh, subdistrictCode: '', subdistrictName: '', postalCode: '' }
          : { provinceCode, provinceName: selectedProvince?.provinceNameTh ?? '', districtCode: '', districtName: '', subdistrictCode: '', subdistrictName: '', postalCode: '' });
      }}>
        <option value="">เลือกอำเภอ / เขต</option>{shownDistricts.map((item) => <option key={item.districtCode} value={code(item.districtCode, 4)}>{item.districtNameTh}</option>)}
      </select>
    </div>
    <div>
      <label htmlFor="address-subdistrict-search" className="mb-1 block text-sm font-semibold text-ink">ค้นหาตำบล / แขวง</label>
      <input id="address-subdistrict-search" className={searchClass} value={subdistrictSearch} onChange={(event) => setSubdistrictSearch(event.target.value)} placeholder="พิมพ์ชื่อตำบลหรือแขวง" disabled={!districtCode} />
      <label htmlFor="address-subdistrict" className="sr-only">ตำบล / แขวง</label>
      <select id="address-subdistrict" className={controlClass} disabled={!districtCode} value={subdistrictCode} onChange={(event) => {
        const next = event.target.value;
        setSubdistrictCode(next);
        const subdistrict = districtSubdistricts.find((item) => code(item.subdistrictCode, 6) === next);
        if (selectedProvince && selectedDistrict && subdistrict) emit(selectedProvince, selectedDistrict, subdistrict);
        else if (selectedProvince && selectedDistrict) onChange({ provinceCode, provinceName: selectedProvince.provinceNameTh, districtCode, districtName: selectedDistrict.districtNameTh, subdistrictCode: '', subdistrictName: '', postalCode: '' });
      }}>
        <option value="">เลือกตำบล / แขวง</option>{shownSubdistricts.map((item) => <option key={item.subdistrictCode} value={code(item.subdistrictCode, 6)}>{item.subdistrictNameTh}</option>)}
      </select>
    </div>
    {selectedPostalCode && <p className="text-sm text-ink-body">รหัสไปรษณีย์: <strong>{selectedPostalCode}</strong></p>}
    <p className="text-xs text-ink-muted">รหัสพื้นที่ใช้รูปแบบจังหวัด 2 หลัก อำเภอ 4 หลัก และตำบล 6 หลัก</p>
  </fieldset>;
};
