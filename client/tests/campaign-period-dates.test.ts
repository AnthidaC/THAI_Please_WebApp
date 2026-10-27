import assert from 'node:assert/strict';
import { bangkokDateTimeToIso, generateMonthlyCampaignPeriods, isoToBangkokDateTime } from '../src/pages/admin/campaigns/campaignPeriodDates';
import { moneyToCents, periodQuotasMatchCampaignTotal, sumMoneyCents } from '../src/pages/admin/campaigns/campaignQuota';

const monthly = generateMonthlyCampaignPeriods('2028-01-31T00:00', '2028-04-30T00:00', 4, 1000);
assert.deepEqual(monthly.map(({ periodName }) => periodName), ['ช่วงที่ 1', 'ช่วงที่ 2', 'ช่วงที่ 3']);
assert.deepEqual(monthly.map(({ startDate, endDate }) => [startDate, endDate]), [
  ['2028-01-31T00:00', '2028-02-29T00:00'],
  ['2028-02-29T00:00', '2028-03-31T00:00'],
  ['2028-03-31T00:00', '2028-04-30T00:00'],
]);
assert.equal(monthly.length, 3, 'periods stop at the exclusive campaign end');
assert.equal(bangkokDateTimeToIso('2026-11-01T00:00'), '2026-10-31T17:00:00.000Z');
assert.equal(isoToBangkokDateTime('2026-10-31T17:00:00.000Z'), '2026-11-01T00:00');
assert.equal(periodQuotasMatchCampaignTotal('0.30', ['0.1', '0.20']), true, 'period sum equality uses exact cents');
assert.equal(periodQuotasMatchCampaignTotal('0.31', ['0.1', '0.20']), false, 'period quotas below the total are rejected');
assert.equal(periodQuotasMatchCampaignTotal('0.29', ['0.1', '0.20']), false, 'period quotas above the total are rejected');
assert.equal(periodQuotasMatchCampaignTotal('100', []), false, 'enabled period configuration must contain periods');
assert.equal(moneyToCents('1.001'), null, 'money precision beyond cents is rejected');
assert.equal(sumMoneyCents(['0.1', '0.2']), 30n);

console.log('Campaign period date tests passed.');
