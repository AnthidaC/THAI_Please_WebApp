/**
 * ข้อมูลพิกัดทางภูมิศาสตร์ (ละติจูด, ลองจิจูด)
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// รัศมีเฉลี่ยของโลก (Earth radius in kilometers)
const EARTH_RADIUS_KM = 6371;

/**
 * ตรวจสอบความถูกต้องของพิกัดละติจูดและลองจิจูด
 * @param lat ละติจูด (-90 ถึง 90)
 * @param lon ลองจิจูด (-180 ถึง 180)
 */
export const isValidCoordinate = (lat: number, lon: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

/**
 * แปลงองศา (Degrees) เป็นเรเดียน (Radians)
 */
const toRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * คำนวณระยะห่างตามเส้นรอบวงโลกด้วยสูตร Haversine (Haversine Distance Formula)
 * @param lat1 ละติจูดจุดที่ 1 (ผู้ใช้งาน)
 * @param lon1 ลองจิจูดจุดที่ 1 (ผู้ใช้งาน)
 * @param lat2 ละติจูดจุดที่ 2 (ร้านค้า)
 * @param lon2 ลองจิจูดจุดที่ 2 (ร้านค้า)
 * @returns ระยะห่างเป็นหน่วยกิโลเมตร (Kilometers)
 */
export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  // ตรวจสอบความถูกต้องของพิกัดทั้งสองจุด
  if (!isValidCoordinate(lat1, lon1)) {
    throw new Error(`พิกัดต้นทางไม่ถูกต้อง: lat=${lat1}, lon=${lon1} (ต้องอยู่ระหว่าง -90 ถึง 90 และ -180 ถึง 180)`);
  }
  if (!isValidCoordinate(lat2, lon2)) {
    throw new Error(`พิกัดปลายทางไม่ถูกต้อง: lat=${lat2}, lon=${lon2} (ต้องอยู่ระหว่าง -90 ถึง 90 และ -180 ถึง 180)`);
  }

  // กรณีพิกัดเดียวกันเป๊ะ ให้คืนค่า 0 ทันที
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  // คำนวณ Haversine Formula: a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  // c = 2 * atan2(√a, √(1−a))
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = EARTH_RADIUS_KM * c;

  // ปัดเศษทศนิยม 3 ตำแหน่ง (ความละเอียดระดับเมตร)
  return Math.round(distanceKm * 1000) / 1000;
};

/**
 * คำนวณระยะห่างระหว่างจุดพิกัด 2 จุดจาก Object Coordinates
 */
export const calculateCoordinatesDistanceKm = (
  from: Coordinates,
  to: Coordinates
): number => {
  return calculateHaversineDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude);
};

/**
 * แปลงระยะทางเป็นคะแนนน้ำหนักสำหรับ Recommendation Engine (Distance Decay Score)
 * ร้านที่ใกล้ที่สุดจะได้คะแนนใกล้เคียง 1.0 และจะค่อยๆ ลดลงตามระยะทาง
 * @param distanceKm ระยะทางเป็นกิโลเมตร
 * @param maxRadiusKm รัศมีสูงสุดในการค้นหา (Default 10 km)
 * @returns คะแนนระหว่าง 0.00 ถึง 1.00
 */
export const calculateDistanceScore = (
  distanceKm: number,
  maxRadiusKm = 10
): number => {
  if (distanceKm <= 0) return 1.0;
  if (distanceKm >= maxRadiusKm) return 0.0;
  // ใช้ Linear Decay ปัดเศษ 3 ตำแหน่ง: ยิ่งใกล้ ยิ่งได้คะแนนสูง
  const score = 1.0 - distanceKm / maxRadiusKm;
  return Math.max(0, Math.min(1.0, Math.round(score * 1000) / 1000));
};

/**
 * จัดรูปแบบข้อความแสดงระยะทางสำหรับ UI
 * ตัวอย่าง: 450 เมตร (ถ้าต่ำกว่า 1 กม.) หรือ 2.4 กม.
 */
export const formatDistanceDisplay = (distanceKm: number): string => {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} ม.`;
  }
  return `${distanceKm.toFixed(1)} กม.`;
};
