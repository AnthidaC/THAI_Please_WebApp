import assert from 'node:assert/strict';
import { getActiveCampaignPeriods, validateCampaignPeriodConfiguration } from '../services/campaign-periods';
import { PaymentService } from '../services/payment.service';
import { createCampaignSchema } from '../validations/gamification.validation';
import { getBangkokDateKey, getDatabaseDateKey, toBangkokDatabaseDate } from '../utils/bangkok-date';

const date = (value: string) => new Date(value);
const period = (start: string, end: string, quota = 100, periodId?: string) => ({
  ...(periodId ? { periodId } : {}),
  periodName: 'Period',
  periodQuotaLimit: quota,
  startDate: date(start),
  endDate: date(end),
});

const campaignStart = date('2026-11-01T00:00:00+07:00');
const campaignEnd = date('2027-03-01T00:00:00+07:00');
const adjacentPeriods = [
  period('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00'),
  period('2026-12-01T00:00:00+07:00', '2027-01-01T00:00:00+07:00'),
];

assert.deepEqual(validateCampaignPeriodConfiguration(adjacentPeriods, campaignStart, campaignEnd, 200), []);
assert.deepEqual(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00', 0.1),
  period('2026-12-01T00:00:00+07:00', '2027-01-01T00:00:00+07:00', 0.2),
], campaignStart, campaignEnd, 0.3), [], 'decimal quotas use exact cent arithmetic');
assert.deepEqual(validateCampaignPeriodConfiguration([], campaignStart, campaignEnd, 3000), [], 'legacy campaigns without periods remain valid');
assert.equal(validateCampaignPeriodConfiguration(adjacentPeriods, campaignStart, campaignEnd, 201).some((issue) => issue.message.includes('equal')), true, 'period quotas below the total are rejected');
assert.equal(validateCampaignPeriodConfiguration(adjacentPeriods, campaignStart, campaignEnd, 199).some((issue) => issue.message.includes('equal')), true, 'period quotas above the total are rejected');
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-12-15T00:00:00+07:00'),
  period('2026-12-01T00:00:00+07:00', '2027-01-01T00:00:00+07:00'),
], campaignStart, campaignEnd, 500).some((issue) => issue.message.includes('overlap')), true);
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-10-31T23:00:00+07:00', '2026-12-01T00:00:00+07:00'),
], campaignStart, campaignEnd, 500).some((issue) => issue.message.includes('within campaign')), true);
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00', 201),
], campaignStart, campaignEnd, 200).some((issue) => issue.message.includes('campaign-wide')), true);
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00', 10, '00000000-0000-4000-8000-000000000001'),
  period('2026-12-01T00:00:00+07:00', '2027-01-01T00:00:00+07:00', 10, '00000000-0000-4000-8000-000000000001'),
], campaignStart, campaignEnd, 100).some((issue) => issue.message.includes('only appear once')), true);
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-11-01T00:00:00+07:00'),
], campaignStart, campaignEnd, 100).some((issue) => issue.message.includes('after its start')), true);
assert.equal(validateCampaignPeriodConfiguration([
  period('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00', -1),
], campaignStart, campaignEnd, 100).some((issue) => issue.message.includes('negative')), true);

const activeAtStart = getActiveCampaignPeriods([
  { start_date: campaignStart, end_date: campaignEnd },
], campaignStart);
const activeAtEnd = getActiveCampaignPeriods([
  { start_date: campaignStart, end_date: campaignEnd },
], campaignEnd);
assert.equal(activeAtStart.length, 1, 'period start is inclusive');
assert.equal(activeAtEnd.length, 0, 'period end is exclusive');

const beforeBangkokMidnight = new Date('2026-10-27T16:59:59.999Z');
const atBangkokMidnight = new Date('2026-10-27T17:00:00.000Z');
assert.equal(getBangkokDateKey(beforeBangkokMidnight), '2026-10-27');
assert.equal(getBangkokDateKey(atBangkokMidnight), '2026-10-28', 'daily quota resets at Bangkok midnight');
assert.equal(getDatabaseDateKey(toBangkokDatabaseDate(atBangkokMidnight)), '2026-10-28', 'Bangkok local date round-trips through a PostgreSQL DATE');

const paymentService = new PaymentService();
const quotaCapped = paymentService.calculateCopay(200, 80, 50);
assert.equal(quotaCapped.governmentCopayAmount, 50, 'daily and total quota caps limit government contribution');
assert.equal(quotaCapped.citizenPaidAmount, 150, 'existing partial-subsidy behavior is preserved');
assert.equal(quotaCapped.dailyQuotaRemainingAfter, 30, 'remaining daily quota reflects the applied cap');

const parsed = createCampaignSchema.safeParse({
  campaignName: 'Period validation test',
  governmentCopayRatePercent: 60,
  citizenPaymentRatePercent: 40,
  dailyQuotaLimit: 200,
  totalQuotaLimit: 100,
  startDate: campaignStart.toISOString(),
  endDate: campaignEnd.toISOString(),
  status: 'ACTIVE',
  periods: adjacentPeriods.map((item) => ({
    periodName: item.periodName,
    periodQuotaLimit: item.periodQuotaLimit,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
  })),
});
assert.equal(parsed.success, false, 'API validation rejects period quotas over the campaign limit');

console.log('Campaign period tests passed.');
