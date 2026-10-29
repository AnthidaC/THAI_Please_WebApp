/**
 * Canonical Merchant Category Taxonomy for THAI Please Web Application
 * Exactly 5 official categories approved for UC 2.5.3 and AI Near-Me Discovery.
 */
export const CANONICAL_CATEGORY_IDS = [
  'FOOD',
  'STREET_FOOD',
  'BAKERY_DESSERT',
  'BEVERAGE',
  'GENERAL_GOODS',
] as const;

export type CanonicalCategoryId = typeof CANONICAL_CATEGORY_IDS[number];

export interface CanonicalCategoryInfo {
  id: CanonicalCategoryId;
  nameTh: string;
  nameEn: string;
  description: string;
}

export const CANONICAL_CATEGORIES: Record<CanonicalCategoryId, CanonicalCategoryInfo> = {
  FOOD: {
    id: 'FOOD',
    nameTh: 'ร้านอาหารทั่วไป',
    nameEn: 'General Food & Restaurants',
    description: 'ร้านอาหารตามสั่ง ข้าวแกง ก๋วยเตี๋ยว และภัตตาคาร',
  },
  STREET_FOOD: {
    id: 'STREET_FOOD',
    nameTh: 'อาหารริมทาง',
    nameEn: 'Street Food & Food Stalls',
    description: 'อาหารจานด่วนริมทาง แผงลอย และร้านรถเข็นชุมชน',
  },
  BAKERY_DESSERT: {
    id: 'BAKERY_DESSERT',
    nameTh: 'ขนมหวานและเบเกอรี่',
    nameEn: 'Bakery & Desserts',
    description: 'ขนมหวาน ขนมไทย เบเกอรี่สด และของว่าง',
  },
  BEVERAGE: {
    id: 'BEVERAGE',
    nameTh: 'เครื่องดื่ม',
    nameEn: 'Beverages & Cafes',
    description: 'ร้านชา กาแฟ คาเฟ่ชุมชน และน้ำดื่มชงสด',
  },
  GENERAL_GOODS: {
    id: 'GENERAL_GOODS',
    nameTh: 'สินค้าทั่วไป',
    nameEn: 'General Goods & Grocery',
    description: 'ร้านของชำ ร้านโชห่วย และของใช้จำเป็นในชีวิตประจำวัน',
  },
};

/**
 * Type guard ตรวจสอบว่า string เป็น CanonicalCategoryId ที่ถูกต้องหรือไม่
 */
export const isValidCategoryId = (id: unknown): id is CanonicalCategoryId => {
  return typeof id === 'string' && CANONICAL_CATEGORY_IDS.includes(id as CanonicalCategoryId);
};

/**
 * ดึงชื่อหมวดหมู่ภาษาไทยตาม category_id (มี fallback สำหรับกรณี null / ไม่มีหมวดหมู่)
 */
export const getCategoryDisplayName = (categoryId?: string | null): string => {
  if (!categoryId || !isValidCategoryId(categoryId)) {
    return 'ร้านค้าสมาชิก Co-pay';
  }
  return CANONICAL_CATEGORIES[categoryId].nameTh;
};
