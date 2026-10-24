/**
 * บริการแปลงพิกัดภูมิศาสตร์ (Latitude / Longitude) เป็นชื่อที่อยู่ภาษาไทยที่อ่านเข้าใจง่าย
 * โดยใช้ Reverse Geocoding API ของ OpenStreetMap (Nominatim)
 * และมีระบบแคชในหน่วยความจำเพื่อลดการเรียกเครือข่ายซ้ำซ้อน
 */

interface NominatimAddress {
  suburb?: string;
  subdistrict?: string;
  quarter?: string;
  village?: string;
  district?: string;
  city_district?: string;
  county?: string;
  city?: string;
  town?: string;
  state?: string;
  province?: string;
  country?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

// In-memory cache โดยใช้คีย์พิกัดปัดเศษ 3 ตำแหน่งทศนิยม (~100 เมตร)
const addressCache = new Map<string, string>();

/**
 * จัดรูปแบบที่อยู่ภาษาไทยให้อ่านกระชับ ชัดเจน (ตำบล/แขวง, อำเภอ/เขต, จังหวัด)
 */
function formatThaiAddress(addr: NominatimAddress): string {
  const isBkk =
    (addr.city && addr.city.includes('กรุงเทพ')) ||
    (addr.state && addr.state.includes('กรุงเทพ')) ||
    (addr.province && addr.province.includes('กรุงเทพ')) ||
    (addr.suburb && addr.suburb.includes('เขต'));

  const subdistrict =
    addr.subdistrict ||
    addr.quarter ||
    (addr.suburb && !addr.suburb.includes('เขต') ? addr.suburb : '') ||
    addr.village ||
    '';

  const district =
    addr.district ||
    addr.city_district ||
    (addr.suburb && addr.suburb.includes('เขต') ? addr.suburb : '') ||
    addr.county ||
    addr.town ||
    (addr.city && !addr.city.includes('กรุงเทพ') ? addr.city : '') ||
    '';

  const province = isBkk ? 'กรุงเทพฯ' : addr.province || addr.state || addr.city || '';

  const parts: string[] = [];

  // เพิ่มส่วนตำบล/แขวง
  if (subdistrict) {
    if (
      !subdistrict.startsWith('แขวง') &&
      !subdistrict.startsWith('ต.') &&
      !subdistrict.startsWith('ตำบล')
    ) {
      parts.push(isBkk ? `แขวง${subdistrict}` : `ต.${subdistrict}`);
    } else {
      parts.push(subdistrict);
    }
  }

  // เพิ่มส่วนอำเภอ/เขต
  if (district) {
    if (
      !district.startsWith('เขต') &&
      !district.startsWith('อ.') &&
      !district.startsWith('อำเภอ')
    ) {
      parts.push(isBkk ? `เขต${district}` : `อ.${district}`);
    } else {
      parts.push(district);
    }
  }

  // เพิ่มส่วนจังหวัด
  if (province) {
    if (province === 'กรุงเทพฯ' || province.includes('กรุงเทพ')) {
      parts.push('กรุงเทพฯ');
    } else if (!province.startsWith('จ.') && !province.startsWith('จังหวัด')) {
      parts.push(`จ.${province}`);
    } else {
      parts.push(province);
    }
  }

  return parts.join(' ') || '';
}

export const geocodingService = {
  /**
   * ดึงชื่อที่อยู่ภาษาไทยจากพิกัด GPS จริง
   * @param latitude ละติจูด
   * @param longitude ลองจิจูด
   * @returns ชื่อที่อยู่ภาษาไทย หรือ null หากเกิดข้อผิดพลาด
   */
  getReadableThaiAddress: async (latitude: number, longitude: number): Promise<string | null> => {
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

    // ตรวจสอบในแคชก่อน
    if (addressCache.has(cacheKey)) {
      return addressCache.get(cacheKey)!;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1&accept-language=th`;
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'th,en',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: NominatimResponse = await response.json();
      if (!data.address) {
        return null;
      }

      const formatted = formatThaiAddress(data.address);
      if (formatted) {
        addressCache.set(cacheKey, formatted);
        return formatted;
      }

      return null;
    } catch (error) {
      console.warn('[GeocodingService] Reverse geocode error:', error);
      return null;
    }
  },
};

export default geocodingService;
