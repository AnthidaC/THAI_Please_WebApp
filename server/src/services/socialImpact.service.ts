import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { HttpError } from '../utils/http-error';

export type SocialImpactRange = 7 | 30 | 90 | 365;
export type ImpactLevel = 'province' | 'district' | 'subdistrict';

export interface DashboardFilterParams {
  level: ImpactLevel;
  from: Date;
  to: Date;
  code?: string;
  provinceName?: string;
}

export interface ImpactAreaResult {
  code: string;
  name: string;
  provinceCode: string;
  districtCode?: string;
  totalCirculation: number;
  benefitedMerchantDays: number;
}

export interface ImpactTimelineResult {
  date: string;
  totalCirculation: number;
  governmentContribution: number;
  citizenContribution: number;
  transactionCount: number;
}

export interface ImpactDashboardResult {
  source: 'daily_social_impact_metrics';
  level: ImpactLevel;
  areas: ImpactAreaResult[];
  timeline: ImpactTimelineResult[];
  totalCirculation: number;
  governmentContribution: number;
  citizenContribution: number;
  benefitedMerchantDays: number;
  transactionCount: number;
  secondaryCityShare: number | null;
  detailUnavailable: boolean;
}

interface ThaiProvince {
  id: number;
  provinceCode: number;
  provinceNameEn: string;
  provinceNameTh: string;
}

interface ThaiDistrict {
  id: number;
  provinceCode: number;
  districtCode: number;
  districtNameEn: string;
  districtNameTh: string;
  postalCode?: number;
}

interface ThaiSubdistrict {
  id: number;
  provinceCode: number;
  districtCode: number;
  subdistrictCode: number;
  subdistrictNameEn: string;
  subdistrictNameTh: string;
  postalCode?: number;
}

// 55 Secondary Cities (เมืองรอง) according to Tourism Authority of Thailand (TAT)
export const SECONDARY_PROVINCES = new Set<string>([
  // Northern (16)
  'เชียงราย', 'แม่ฮ่องสอน', 'ลำปาง', 'ลำพูน', 'แพร่', 'น่าน', 'พะเยา', 'อุตรดิตถ์',
  'พิษณุโลก', 'สุโขทัย', 'เพชรบูรณ์', 'พิจิตร', 'กำแพงเพชร', 'นครสวรรค์', 'อุทัยธานี', 'ตาก',
  // Northeastern (18)
  'อุดรธานี', 'หนองคาย', 'บึงกาฬ', 'เลย', 'สกลนคร', 'นครพนม', 'มุกดาหาร', 'อุบลราชธานี',
  'ยโสธร', 'อำนาจเจริญ', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'มหาสารคาม', 'บุรีรัมย์', 'สุรินทร์',
  'ศรีสะเกษ', 'ชัยภูมิ', 'หนองบัวลำภู',
  // Eastern (5)
  'สระแก้ว', 'ปราจีนบุรี', 'นครนายก', 'ตราด', 'จันทบุรี',
  // Central & Western (7)
  'ลพบุรี', 'สุพรรณบุรี', 'ชัยนาท', 'สิงห์บุรี', 'อ่างทอง', 'ราชบุรี', 'สมุทรสงคราม',
  // Southern (9)
  'ชุมพร', 'ระนอง', 'นครศรีธรรมราช', 'พัทลุง', 'ตรัง', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส',
]);

const loadJsonSafe = <T>(filename: string): T[] => {
  const possiblePaths = [
    path.resolve(__dirname, '../data/thai-address', filename),
    path.resolve(__dirname, '../../src/data/thai-address', filename),
    path.resolve(process.cwd(), 'src/data/thai-address', filename),
    path.resolve(process.cwd(), 'server/src/data/thai-address', filename),
    path.resolve(process.cwd(), '../client/src/data/thai-address', filename),
    path.resolve(process.cwd(), 'client/src/data/thai-address', filename),
  ];
  for (const targetPath of possiblePaths) {
    if (fs.existsSync(targetPath)) {
      try {
        return JSON.parse(fs.readFileSync(targetPath, 'utf8')) as T[];
      } catch {
        // try next path
      }
    }
  }
  return [];
};

let cachedProvinces: ThaiProvince[] | null = null;
let cachedDistricts: ThaiDistrict[] | null = null;
let cachedSubdistricts: ThaiSubdistrict[] | null = null;

const getProvinces = (): ThaiProvince[] => {
  if (!cachedProvinces) cachedProvinces = loadJsonSafe<ThaiProvince>('provinces.json');
  return cachedProvinces;
};

const getDistricts = (): ThaiDistrict[] => {
  if (!cachedDistricts) cachedDistricts = loadJsonSafe<ThaiDistrict>('districts.json');
  return cachedDistricts;
};

const getSubdistricts = (): ThaiSubdistrict[] => {
  if (!cachedSubdistricts) cachedSubdistricts = loadJsonSafe<ThaiSubdistrict>('subdistricts.json');
  return cachedSubdistricts;
};

export interface ResolvedMerchantLocation {
  provinceName: string;
  provinceCode: string;
  districtName: string;
  districtCode: string;
  subdistrictName: string;
  subdistrictCode: string;
  isSecondaryCity: boolean;
}

export const resolveMerchantLocation = (merchant: {
  merchant_id: string;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  shop_name?: string;
  merchant_application?: {
    address?: string | null;
  } | null;
}): ResolvedMerchantLocation => {
  const addr = (merchant.merchant_application?.address ?? '').trim();
  const lat = Number(merchant.latitude);
  const lng = Number(merchant.longitude);

  const provinces = getProvinces();
  const districts = getDistricts();
  const subdistricts = getSubdistricts();

  let province: ThaiProvince | undefined;
  let district: ThaiDistrict | undefined;
  let subdistrict: ThaiSubdistrict | undefined;

  // 1. Check address text for province
  for (const p of provinces) {
    if (addr.includes(p.provinceNameTh) || (p.provinceNameEn && addr.toLowerCase().includes(p.provinceNameEn.toLowerCase()))) {
      province = p;
      break;
    }
  }

  // 2. Check address text for district
  if (province) {
    const provinceDistricts = districts.filter((d) => d.provinceCode === province!.provinceCode);
    for (const d of provinceDistricts) {
      if (addr.includes(d.districtNameTh) || (d.districtNameEn && addr.toLowerCase().includes(d.districtNameEn.toLowerCase()))) {
        district = d;
        break;
      }
    }
  }

  // 3. Check address text for subdistrict
  if (district) {
    const districtSubdistricts = subdistricts.filter((s) => s.districtCode === district!.districtCode);
    for (const s of districtSubdistricts) {
      if (addr.includes(s.subdistrictNameTh) || (s.subdistrictNameEn && addr.toLowerCase().includes(s.subdistrictNameEn.toLowerCase()))) {
        subdistrict = s;
        break;
      }
    }
    if (!subdistrict) {
      const zipMatch = addr.match(/\b(\d{5})\b/);
      if (zipMatch) {
        const zip = Number(zipMatch[1]);
        subdistrict = districtSubdistricts.find((s) => s.postalCode === zip) ?? districtSubdistricts[0];
      } else {
        subdistrict = districtSubdistricts[0];
      }
    }
  }

  // 4. Coordinates matching fallback
  if (!province) {
    if (lat >= 13.9 && lat <= 14.2 && lng >= 99.8 && lng <= 100.2) {
      // Nakhon Pathom / Kamphaeng Saen area
      province = provinces.find((p) => p.provinceCode === 73);
      district = districts.find((d) => d.districtCode === 7302 || d.districtNameTh === 'กำแพงแสน');
      subdistrict = subdistricts.find((s) => s.subdistrictCode === 730212);
    } else if (lat >= 13.5 && lat <= 13.9 && lng >= 100.3 && lng <= 100.7) {
      // Bangkok
      province = provinces.find((p) => p.provinceCode === 10);
      district = districts.find((d) => d.districtCode === 1001 || d.districtNameTh === 'พระนคร');
      subdistrict = subdistricts.find((s) => s.subdistrictCode === 100101);
    }
  }

  // Ensure district and subdistrict exist
  if (province && !district) {
    district = districts.find((d) => d.provinceCode === province!.provinceCode);
  }
  if (district && !subdistrict) {
    subdistrict = subdistricts.find((s) => s.districtCode === district!.districtCode);
  }

  const provName = province?.provinceNameTh ?? 'กรุงเทพมหานคร';
  return {
    provinceName: provName,
    provinceCode: String(province?.provinceCode ?? '10'),
    districtName: district?.districtNameTh ?? 'พระนคร',
    districtCode: String(district?.districtCode ?? '1001'),
    subdistrictName: subdistrict?.subdistrictNameTh ?? 'พระบรมมหาราชวัง',
    subdistrictCode: String(subdistrict?.subdistrictCode ?? '100101'),
    isSecondaryCity: SECONDARY_PROVINCES.has(provName),
  };
};

const parseRange = (days: number): SocialImpactRange => {
  if (days === 7 || days === 30 || days === 90 || days === 365) return days;
  throw new HttpError(400, 'เลือกช่วงเวลา 7, 30, 90 หรือ 365 วัน');
};

const getStartDate = (days: SocialImpactRange): Date =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export const socialImpactService = {
  async getSummary(requestedDays: number) {
    const days = parseRange(requestedDays);
    const startDate = getStartDate(days);
    const completedStatuses = ['SUCCESS', 'FLAGGED'];

    const [totals, timeline] = await Promise.all([
      prisma.transactions.aggregate({
        where: {
          status: { in: completedStatuses },
          total_amount: { gt: 0 },
          OR: [
            { completed_at: { gte: startDate } },
            { completed_at: null, created_at: { gte: startDate } },
          ],
        },
        _sum: {
          total_amount: true,
          government_copay_amount: true,
          citizen_paid_amount: true,
        },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{
        bucket: Date;
        total_amount: Prisma.Decimal;
        government_amount: Prisma.Decimal;
        citizen_amount: Prisma.Decimal;
        transaction_count: bigint;
      }>>(Prisma.sql`
        SELECT
          date_trunc('day', COALESCE(completed_at, created_at)) AS bucket,
          SUM(total_amount)::numeric AS total_amount,
          SUM(government_copay_amount)::numeric AS government_amount,
          SUM(citizen_paid_amount)::numeric AS citizen_amount,
          COUNT(*)::bigint AS transaction_count
        FROM transactions
        WHERE status IN ('SUCCESS', 'FLAGGED')
          AND total_amount > 0
          AND COALESCE(completed_at, created_at) >= ${startDate}
        GROUP BY date_trunc('day', COALESCE(completed_at, created_at))
        ORDER BY bucket ASC
      `),
    ]);

    return {
      rangeDays: days,
      refreshedAt: new Date().toISOString(),
      summary: {
        totalCirculation: Number(totals._sum.total_amount ?? 0),
        governmentContribution: Number(totals._sum.government_copay_amount ?? 0),
        citizenContribution: Number(totals._sum.citizen_paid_amount ?? 0),
        transactionCount: totals._count._all,
      },
      timeline: timeline.map((item) => ({
        date: item.bucket.toISOString(),
        totalCirculation: Number(item.total_amount),
        governmentContribution: Number(item.government_amount),
        citizenContribution: Number(item.citizen_amount),
        transactionCount: Number(item.transaction_count),
      })),
    };
  },

  async getHeatmap(requestedDays: number) {
    const days = parseRange(requestedDays);
    const startDate = getStartDate(days);
    const points = await prisma.$queryRaw<Array<{
      latitude: Prisma.Decimal;
      longitude: Prisma.Decimal;
      total_amount: Prisma.Decimal;
      transaction_count: bigint;
    }>>(Prisma.sql`
      SELECT
        ROUND(COALESCE(fc.merchant_latitude, m.latitude)::numeric, 2) AS latitude,
        ROUND(COALESCE(fc.merchant_longitude, m.longitude)::numeric, 2) AS longitude,
        SUM(t.total_amount)::numeric AS total_amount,
        COUNT(*)::bigint AS transaction_count
      FROM transactions t
      JOIN merchants m ON m.merchant_id = t.merchant_id
      LEFT JOIN fraud_checks fc ON fc.transaction_id = t.transaction_id
      WHERE t.status IN ('SUCCESS', 'FLAGGED')
        AND t.total_amount > 0
        AND COALESCE(t.completed_at, t.created_at) >= ${startDate}
      GROUP BY 1, 2
      ORDER BY SUM(t.total_amount) DESC
    `);

    return {
      rangeDays: days,
      refreshedAt: new Date().toISOString(),
      coordinatePrecision: 'approximately 1 km',
      locations: points.map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        totalCirculation: Number(point.total_amount),
        transactionCount: Number(point.transaction_count),
      })),
    };
  },

  /**
   * Synchronize all completed transactions into daily_social_impact_metrics table
   */
  async syncDailyMetrics(): Promise<void> {
    const merchants = await prisma.merchants.findMany({
      include: { merchant_application: true },
    });
    const locMap = new Map(merchants.map((m) => [m.merchant_id, resolveMerchantLocation(m)]));

    const allTx = await prisma.transactions.findMany({
      where: {
        status: { in: ['SUCCESS', 'FLAGGED'] },
        total_amount: { gt: 0 },
      },
      select: {
        merchant_id: true,
        user_id: true,
        total_amount: true,
        created_at: true,
        completed_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const dailyGroups = new Map<string, {
      date: string;
      province: string;
      totalSpending: number;
      merchants: Set<string>;
      users: Set<string>;
    }>();

    for (const tx of allTx) {
      const date = (tx.completed_at ?? tx.created_at).toISOString().slice(0, 10);
      const loc = locMap.get(tx.merchant_id) ?? { provinceName: 'กรุงเทพมหานคร' };
      const key = `${date}:${loc.provinceName}`;

      if (!dailyGroups.has(key)) {
        dailyGroups.set(key, {
          date,
          province: loc.provinceName,
          totalSpending: 0,
          merchants: new Set(),
          users: new Set(),
        });
      }
      const group = dailyGroups.get(key)!;
      group.totalSpending += Number(tx.total_amount);
      group.merchants.add(tx.merchant_id);
      group.users.add(tx.user_id);
    }

    for (const group of dailyGroups.values()) {
      const metricDate = new Date(`${group.date}T00:00:00.000Z`);
      await prisma.daily_social_impact_metrics.upsert({
        where: {
          metric_date_province: {
            metric_date: metricDate,
            province: group.province,
          },
        },
        update: {
          total_spending_amount: group.totalSpending,
          benefited_merchants_count: group.merchants.size,
          new_customers_count: group.users.size,
        },
        create: {
          metric_date: metricDate,
          province: group.province,
          total_spending_amount: group.totalSpending,
          benefited_merchants_count: group.merchants.size,
          new_customers_count: group.users.size,
        },
      });
    }
  },

  /**
   * Get authoritative social impact dashboard aggregated from real transactions & merchants
   */
  async getDashboard(params: DashboardFilterParams): Promise<ImpactDashboardResult> {
    const { level, from, to, code, provinceName } = params;

    // Load merchants and build resolution map
    const merchants = await prisma.merchants.findMany({
      include: { merchant_application: true },
    });
    const locMap = new Map(merchants.map((m) => [m.merchant_id, resolveMerchantLocation(m)]));

    // Query completed transactions within date range
    const allTx = await prisma.transactions.findMany({
      where: {
        status: { in: ['SUCCESS', 'FLAGGED'] },
        total_amount: { gt: 0 },
        OR: [
          { completed_at: { gte: from, lte: to } },
          { completed_at: null, created_at: { gte: from, lte: to } },
        ],
      },
      select: {
        transaction_id: true,
        merchant_id: true,
        total_amount: true,
        government_copay_amount: true,
        citizen_paid_amount: true,
        created_at: true,
        completed_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Filter transactions based on current level & parent code/name
    const filteredTx = allTx.filter((tx) => {
      const loc = locMap.get(tx.merchant_id);
      if (!loc) return false;
      if (level === 'district') {
        return (code && (loc.provinceCode === code || loc.provinceName === code)) ||
               (provinceName && loc.provinceName === provinceName);
      }
      if (level === 'subdistrict') {
        return code && (loc.districtCode === code || loc.districtName === code);
      }
      return true;
    });

    let totalCirculation = 0;
    let governmentContribution = 0;
    let citizenContribution = 0;
    let secondaryCirculation = 0;
    const globalMerchantDays = new Set<string>();
    const areaMap = new Map<string, {
      code: string;
      name: string;
      provinceCode: string;
      districtCode?: string;
      totalCirculation: number;
      merchantDays: Set<string>;
    }>();
    const timelineMap = new Map<string, {
      date: string;
      totalCirculation: number;
      governmentContribution: number;
      citizenContribution: number;
      transactionCount: number;
    }>();

    for (const tx of filteredTx) {
      const loc = locMap.get(tx.merchant_id)!;
      const amt = Number(tx.total_amount);
      const gov = Number(tx.government_copay_amount);
      const cit = Number(tx.citizen_paid_amount);
      const dateStr = (tx.completed_at ?? tx.created_at).toISOString().slice(0, 10);

      totalCirculation += amt;
      governmentContribution += gov;
      citizenContribution += cit;
      if (loc.isSecondaryCity) secondaryCirculation += amt;
      globalMerchantDays.add(`${dateStr}:${tx.merchant_id}`);

      // Area grouping
      let aCode = loc.provinceCode;
      let aName = loc.provinceName;
      if (level === 'district') {
        aCode = loc.districtCode;
        aName = loc.districtName;
      } else if (level === 'subdistrict') {
        aCode = loc.subdistrictCode;
        aName = loc.subdistrictName;
      }

      if (!areaMap.has(aCode)) {
        areaMap.set(aCode, {
          code: aCode,
          name: aName,
          provinceCode: loc.provinceCode,
          districtCode: loc.districtCode,
          totalCirculation: 0,
          merchantDays: new Set(),
        });
      }
      const area = areaMap.get(aCode)!;
      area.totalCirculation += amt;
      area.merchantDays.add(`${dateStr}:${tx.merchant_id}`);

      // Timeline grouping
      if (!timelineMap.has(dateStr)) {
        timelineMap.set(dateStr, {
          date: dateStr,
          totalCirculation: 0,
          governmentContribution: 0,
          citizenContribution: 0,
          transactionCount: 0,
        });
      }
      const t = timelineMap.get(dateStr)!;
      t.totalCirculation += amt;
      t.governmentContribution += gov;
      t.citizenContribution += cit;
      t.transactionCount += 1;
    }

    const areas: ImpactAreaResult[] = Array.from(areaMap.values()).map((a) => ({
      code: a.code,
      name: a.name,
      provinceCode: a.provinceCode,
      districtCode: a.districtCode,
      totalCirculation: a.totalCirculation,
      benefitedMerchantDays: a.merchantDays.size,
    })).sort((a, b) => b.totalCirculation - a.totalCirculation);

    const timeline: ImpactTimelineResult[] = Array.from(timelineMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const secondaryCityShare = totalCirculation > 0
      ? Math.round((secondaryCirculation / totalCirculation) * 100)
      : 0;

    // Asynchronously sync daily_social_impact_metrics table without blocking
    void this.syncDailyMetrics().catch(() => {});

    return {
      source: 'daily_social_impact_metrics',
      level,
      areas,
      timeline,
      totalCirculation,
      governmentContribution,
      citizenContribution,
      benefitedMerchantDays: globalMerchantDays.size,
      transactionCount: filteredTx.length,
      secondaryCityShare,
      detailUnavailable: false,
    };
  },
};
