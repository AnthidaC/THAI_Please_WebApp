import assert from 'node:assert/strict';

const campaignId = '00000000-0000-4000-8000-000000000010';
const walletId = '00000000-0000-4000-8000-000000000020';
const firstPeriodId = '00000000-0000-4000-8000-000000000030';
const secondPeriodId = '00000000-0000-4000-8000-000000000040';
const newPeriodId = '00000000-0000-4000-8000-000000000050';
const now = new Date();
const campaignStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const firstPeriodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const secondPeriodStart = firstPeriodEnd;
const thirdPeriodStart = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const campaignEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

const periods = [
  {
    period_id: firstPeriodId,
    period_name: 'October',
    period_quota_limit: 1000,
    start_date: campaignStart,
    end_date: firstPeriodEnd,
  },
  {
    period_id: secondPeriodId,
    period_name: 'November–December',
    period_quota_limit: 1000,
    start_date: secondPeriodStart,
    end_date: campaignEnd,
  },
];

const allocations = [
  { wallet_id: walletId, period_id: firstPeriodId, quota_limit: 1000, quota_used: 75, quota_remaining: 925 },
  { wallet_id: walletId, period_id: secondPeriodId, quota_limit: 1000, quota_used: 0, quota_remaining: 1000 },
];

const campaign = {
  campaign_id: campaignId,
  campaign_name: 'Period allocation test',
  government_copay_rate_percent: 60,
  citizen_payment_rate_percent: 40,
  daily_quota_limit: 150,
  total_quota_limit: 3000,
  start_date: campaignStart,
  end_date: campaignEnd,
  status: 'ACTIVE',
  created_at: campaignStart,
};

const mock: any = {};
mock.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(mock);
mock.$queryRaw = async () => [];
mock.campaigns = {
  findUnique: async ({ where }: any) => where.campaign_id === campaignId ? {
    ...campaign,
    campaign_periods: periods.map((period) => ({
      ...period,
      _count: { wallet_period_quotas: allocations.filter((row) => row.period_id === period.period_id).length },
    })),
    _count: { quests: 0 },
  } : null,
  update: async () => campaign,
};
mock.campaign_periods = {
  update: async ({ where, data }: any) => {
    const period = periods.find((item) => item.period_id === where.period_id)!;
    Object.assign(period, data);
    return period;
  },
  create: async ({ data }: any) => {
    const period = { period_id: newPeriodId, ...data };
    periods.push(period);
    return period;
  },
  deleteMany: async () => ({ count: 0 }),
};
mock.wallets = {
  findMany: async () => [{ wallet_id: walletId }],
};
mock.wallet_period_quotas = {
  groupBy: async ({ where }: any) => {
    const ids: string[] = where.period_id.in;
    return ids.flatMap((periodId) => {
      const used = allocations
        .filter((row) => row.period_id === periodId)
        .reduce((total, row) => total + row.quota_used, 0);
      return used > 0 ? [{ period_id: periodId, _sum: { quota_used: used } }] : [];
    });
  },
  createMany: async ({ data }: any) => {
    for (const row of data) {
      if (!allocations.some((existing) => existing.wallet_id === row.wallet_id && existing.period_id === row.period_id)) {
        allocations.push(row);
      }
    }
    return { count: data.length };
  },
};

async function main() {
  (globalThis as any).prisma = mock;
  const { gamificationService } = await import('../services/gamification.service');

  const originalFirstAllocation = { ...allocations[0] };
  const originalSecondAllocation = { ...allocations[1] };
  const requestPeriods = [
    { periodId: firstPeriodId, periodName: 'October', periodQuotaLimit: 1000, startDate: campaignStart, endDate: firstPeriodEnd },
    { periodId: secondPeriodId, periodName: 'November', periodQuotaLimit: 1000, startDate: secondPeriodStart, endDate: thirdPeriodStart },
    { periodName: 'December', periodQuotaLimit: 1000, startDate: thirdPeriodStart, endDate: campaignEnd },
  ];

  await gamificationService.updateCampaign(campaignId, { periods: requestPeriods });

  assert.equal(periods.length, 3, 'the future two-month period is split while retaining its identity');
  assert.equal(periods[1].period_id, secondPeriodId);
  assert.equal(periods[1].end_date, thirdPeriodStart);
  assert.equal(periods[2].period_id, newPeriodId);
  assert.equal(allocations.length, 3, 'a matching allocation is created for each campaign wallet');
  assert.deepEqual(allocations[0], originalFirstAllocation, 'existing used quota is preserved');
  assert.deepEqual(allocations[1], originalSecondAllocation, 'the existing period allocation is preserved');
  assert.deepEqual(allocations[2], {
    wallet_id: walletId,
    period_id: newPeriodId,
    quota_limit: 1000,
    quota_used: 0,
    quota_remaining: 1000,
  });

  const beforeRejectedEdit = periods.map((period) => ({ ...period }));
  await assert.rejects(
    gamificationService.updateCampaign(campaignId, {
      periods: requestPeriods.map((period) => period.periodId === firstPeriodId
        ? { ...period, periodName: 'Changed started period' }
        : period),
    }),
    (error: any) => error.statusCode === 409,
    'started periods remain protected from edits',
  );
  assert.deepEqual(periods, beforeRejectedEdit, 'a rejected started-period edit leaves configuration unchanged');

  console.log('Campaign period allocation tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
