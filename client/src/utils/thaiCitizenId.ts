import provinces from '../data/thai-address/provinces.json';

export interface CitizenProvinceOption {
  code: string;
  name: string;
}

export const citizenProvinceOptions: CitizenProvinceOption[] = provinces.map((province) => ({
  code: String(province.provinceCode).padStart(2, '0'),
  name: province.provinceNameTh,
}));

export const isValidThaiCitizenId = (citizenId: string): boolean => {
  if (!/^\d{13}$/.test(citizenId)) return false;

  let weightedSum = 0;
  for (let index = 0; index < 12; index += 1) {
    weightedSum += Number(citizenId[index]) * (13 - index);
  }
  const checkDigit = (11 - (weightedSum % 11)) % 10;
  return Number(citizenId[12]) === checkDigit;
};

