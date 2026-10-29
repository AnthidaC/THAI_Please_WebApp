import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { HttpError } from '../utils/http-error';

export type SocialImpactRange = 7 | 30 | 90 | 365;

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
};
