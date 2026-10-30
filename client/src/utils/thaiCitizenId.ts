import provinces from '../data/thai-address/provinces.json';

export interface CitizenProvinceOption {
  code: string;
  name: string;
}

export const citizenProvinceOptions: CitizenProvinceOption[] = provinces.map((province) => ({
  code: String(province.provinceCode).padStart(2, '0'),
  name: province.provinceNameTh,
}));

/**
 * ตรวจสอบเลขประจำตัว 13 หลัก — ตรวจสอบเฉพาะความยาวตัวเลข 13 หลัก
 */
export const isValidThaiCitizenId = (citizenId: string): boolean => {
  return /^\d{13}$/.test(citizenId.trim());
};
