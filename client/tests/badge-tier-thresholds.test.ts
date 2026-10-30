import assert from 'node:assert/strict';
import {
  BADGE_TIER_IDENTITIES,
  BADGE_TIER_MAX,
  beginBadgePointerInteraction,
  calculateBadgeProgressPreview,
  endBadgePointerInteraction,
  formatBadgeThreshold,
  getBadgeSliderMax,
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
assert.equal(increaseBadgeSliderMax(Number.NaN), 5, 'invalid range expansion stays finite and bounded');
assert.equal(increaseBadgeSliderMax(Number.POSITIVE_INFINITY), 5, 'infinite range expansion stays finite and bounded');
assert.equal(getBadgeSliderMax(['5', '20', '50', '100'], Number.NaN, null), 200, 'invalid expanded ranges cannot poison the scale');
assert.equal(getBadgeSliderMax(['5', '20', '50', '100'], BADGE_TIER_MAX + 1, null), 2_147_483_647, 'expanded ranges respect the backend integer bound');

let pointer = beginBadgePointerInteraction(null, 7, 200);
assert.equal(pointer.frozenMax, 200);
let heldValues = ['5', '20', '50', '100'];
for (let attempt = 0; attempt < 250; attempt += 1) {
  const activeMax = getBadgeSliderMax(heldValues, 0, pointer.frozenMax);
  assert.equal(activeMax, 200, 'a held Platinum drag keeps the range frozen');
  heldValues = ['5', '20', '50', String(Math.min(activeMax, BADGE_TIER_MAX))];
  assert.deepEqual(heldValues.slice(0, 3), ['5', '20', '50'], 'the other three thresholds stay unchanged');
}
assert.equal(heldValues[3], '200', 'a drag cannot pass the frozen maximum');
assert.equal(getBadgeSliderMax(heldValues, 0, null), 500, 'releasing permits one controlled range expansion');
pointer = beginBadgePointerInteraction(null, 8, getBadgeSliderMax(heldValues, 0, null));
assert.equal(pointer.frozenMax, 500, 'a second drag starts with the expanded range');
assert.equal(getBadgeSliderMax(['5', '20', '50', '500'], 0, pointer.frozenMax), 500, 'the second drag also remains frozen');
assert.deepEqual(endBadgePointerInteraction(pointer, 99), pointer, 'another pointer cannot end the active drag');
assert.equal(endBadgePointerInteraction(pointer, 8), null, 'pointer release ends the frozen range');
const cancelledPointer = beginBadgePointerInteraction(null, 9, 200);
assert.equal(endBadgePointerInteraction(cancelledPointer, 9), null, 'pointer cancellation restores the non-drag state');
assert.equal(getBadgeSliderMax(['5', '20', '50', '100'], 0, null), 200, 'cancellation leaves a stable range when the committed values did not change');

const typedLargeThresholds = ['50', '1000', '5000', '50000'];
assert.equal(validateBadgeThresholds(typedLargeThresholds).valid, true, 'numeric inputs accept larger supported thresholds');
assert.ok(getBadgeSliderMax(typedLargeThresholds, 0, null) >= 50_000, 'numeric edits expand the scale to fit the valid threshold');
assert.equal(getBadgeSliderMax(['5', '20', '50', '2147483647'], 0, null), BADGE_TIER_MAX, 'largest supported values remain bounded');
assert.ok(getBadgeSliderMax(['5', '20', '50', '100'], 0, null) <= BADGE_TIER_MAX, 'slider scale never exceeds the backend bound');

assert.deepEqual(scaleBadgeThresholds(startingThresholds, 200), { values: ['10', '40', '100', '200'], error: null });
for (let attempt = 0; attempt < 100; attempt += 1) {
  assert.deepEqual(scaleBadgeThresholds(startingThresholds, 200), { values: ['10', '40', '100', '200'], error: null }, 'proportional scaling remains stable across repeated updates');
}
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
assert.equal(calculateBadgeProgressPreview(startingThresholds, BADGE_TIER_MAX + 1), null, 'preview input cannot exceed the supported integer range');

console.log('Badge tier threshold helper checks passed');
