import assert from 'node:assert/strict';
import {
  BADGE_TIER_IDENTITIES,
  calculateBadgeProgressPreview,
  formatBadgeThreshold,
  getDefaultBadgeThresholds,
  getSuggestedBadgeSliderMax,
  increaseBadgeSliderMax,
  scaleBadgeThresholds,
  validateBadgeThresholds,
} from '../src/components/badges/badgeTierThresholds';

assert.deepEqual(BADGE_TIER_IDENTITIES.map((tier) => tier.name), ['Bronze', 'Silver', 'Gold', 'Platinum']);
assert.deepEqual(getDefaultBadgeThresholds('count', 'transaction_count'), [5, 20, 50, 100]);
assert.deepEqual(getDefaultBadgeThresholds('count', 'referral_count'), [1, 5, 15, 30]);
assert.deepEqual(getDefaultBadgeThresholds('count', 'review_count'), [3, 10, 25, 50]);
assert.deepEqual(getDefaultBadgeThresholds('amount', 'total_spending'), [500, 2_000, 5_000, 10_000]);
assert.equal(formatBadgeThreshold(10_000, 'amount'), '10,000 บาท');
assert.deepEqual(validateBadgeThresholds(['5', '20', '50', '100']).errors, [null, null, null, null]);
assert.equal(validateBadgeThresholds(['5', '20', '20', '100']).valid, false, 'equal thresholds are rejected');
assert.equal(validateBadgeThresholds(['5', '', '50', '100']).valid, false, 'intermediate input is reported without coercing it');

const startingThresholds = ['5', '20', '50', '100'];
assert.equal(validateBadgeThresholds(['1.5', '20', '50', '100']).valid, false, 'fractional thresholds are rejected');
assert.equal(validateBadgeThresholds(['5', '20', '50', '2147483648']).valid, false, 'thresholds above the database integer limit are rejected');
assert.ok(getSuggestedBadgeSliderMax(startingThresholds) > 100, 'slider range grows beyond 100');
assert.ok(getSuggestedBadgeSliderMax(['500', '2000', '5000', '10000']) >= 10_000, 'large amount thresholds fit the scale');
assert.ok(increaseBadgeSliderMax(100) > 100, 'admins can expand the visible scale');
assert.deepEqual(scaleBadgeThresholds(startingThresholds, 200), { values: ['10', '40', '100', '200'], error: null });
assert.deepEqual(scaleBadgeThresholds(startingThresholds, 2_147_483_647), {
  values: ['107374182', '429496729', '1073741824', '2147483647'],
  error: null,
}, 'large proportional thresholds round exactly within the database integer limit');
assert.deepEqual(scaleBadgeThresholds(['1', '2', '3', '4'], 5), { values: ['1', '3', '4', '5'], error: null }, 'rounding keeps all thresholds distinct and ordered');
assert.equal(scaleBadgeThresholds(startingThresholds, 3).values, null, 'impossible scaling targets are rejected');
assert.deepEqual(calculateBadgeProgressPreview(startingThresholds, 4), {
  currentTier: null,
  nextTier: BADGE_TIER_IDENTITIES[0],
  remaining: 1,
  highestTierAchieved: false,
});
assert.equal(calculateBadgeProgressPreview(startingThresholds, 5)?.currentTier?.name, 'Bronze');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 19)?.nextTier?.name, 'Silver');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 20)?.currentTier?.name, 'Silver');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 49)?.nextTier?.name, 'Gold');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 50)?.currentTier?.name, 'Gold');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 100)?.currentTier?.name, 'Platinum');
assert.equal(calculateBadgeProgressPreview(startingThresholds, 150)?.highestTierAchieved, true);
assert.equal(calculateBadgeProgressPreview(['5', '', '50', '100'], 20), null, 'invalid thresholds suppress the preview');

console.log('Badge tier threshold helper checks passed');
