import assert from 'node:assert/strict';
import { badgeCreateSchema, badgeUpdateSchema } from '../validations/badge-management.validation';
import {
  assertBadgeTierIdsStayWithLevels,
  assertEarnedTiersUnchanged,
  FIXED_BADGE_TIER_IDENTITIES,
  getBadgeActivationBlocker,
  hasFixedBadgeTierStructure,
} from '../services/badge-management.rules';
import { toBadgeCreateData } from '../services/adminBadge.service';
import { BadgeConditionRegistry } from '../services/achievements/conditionRegistry';
const validBadge = {
  badgeName: 'Referral Master',
  description: 'Successfully refer other users',
  conditionType: 'referral_count',
  tiers: [
    { tierName: 'Bronze', tierLevel: 1, requiredCount: 1 },
    { tierName: 'Silver', tierLevel: 2, requiredCount: 5 },
    { tierName: 'Gold', tierLevel: 3, requiredCount: 15 },
    { tierName: 'Platinum', tierLevel: 4, requiredCount: 30 },
  ],
};

assert.equal(badgeCreateSchema.safeParse(validBadge).success, true);
assert.equal(badgeUpdateSchema.safeParse({ tiers: validBadge.tiers }).success, true, 'a valid fixed-tier update is accepted');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  status: 'active',
}).success, false, 'creation cannot override the inactive default');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  implementationStatus: 'ready',
}).success, false, 'creation cannot override the pending default');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [validBadge.tiers[0], { ...validBadge.tiers[1], tierLevel: 1 }, ...validBadge.tiers.slice(2)],
}).success, false, 'duplicate tier levels must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [validBadge.tiers[0], { ...validBadge.tiers[1], requiredCount: 1 }, ...validBadge.tiers.slice(2)],
}).success, false, 'duplicate thresholds must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [{ ...validBadge.tiers[0], requiredCount: 0 }],
}).success, false, 'non-positive thresholds must be rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: [{ ...validBadge.tiers[0], requiredCount: 5 }, { ...validBadge.tiers[1], requiredCount: 4 }, ...validBadge.tiers.slice(2)],
}).success, false, 'thresholds must increase by tier level');
assert.equal(badgeCreateSchema.safeParse({ ...validBadge, tiers: validBadge.tiers.slice(0, 3) }).success, false, 'three tiers are rejected');
assert.equal(badgeCreateSchema.safeParse({ ...validBadge, tiers: [...validBadge.tiers, validBadge.tiers[3]] }).success, false, 'five tiers are rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: validBadge.tiers.map((tier, index) => index === 3 ? { ...tier, tierName: 'Diamond' } : tier),
}).success, false, 'custom tier identities are rejected');
assert.equal(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: validBadge.tiers.map((tier, index) => index === 3 ? { ...tier, requiredCount: 2_147_483_648 } : tier),
}).success, false, 'thresholds must fit the existing INTEGER column');
assert.ok(badgeCreateSchema.safeParse({
  ...validBadge,
  tiers: validBadge.tiers.map((tier, index) => index === 3 ? { ...tier, requiredCount: 'not-a-number' } : tier),
}).error?.errors.every((issue) => issue.message.length > 0), 'invalid numeric input returns structured validation issues');
assert.equal(badgeUpdateSchema.safeParse({ conditionType: 'new_type' }).success, false, 'condition type must be immutable');
assert.equal(badgeUpdateSchema.safeParse({ badgeName: 'Updated Badge Name' }).success, true, 'metadata updates do not require tier data');
assert.equal(badgeUpdateSchema.safeParse({}).success, false, 'empty updates must be rejected');
const createData = toBadgeCreateData(validBadge);
assert.equal(createData.badge_tiers.create.length, 4, 'Badge and exactly four tiers are submitted as one nested Prisma create');
assert.deepEqual(createData.badge_tiers.create.map((tier) => tier.tier_name), ['Bronze', 'Silver', 'Gold', 'Platinum']);
assert.equal('status' in createData, false, 'client cannot set activation status during creation');
assert.equal('implementation_status' in createData, false, 'client cannot set implementation status during creation');

const fixedTierDefinitions = FIXED_BADGE_TIER_IDENTITIES.map((identity, index) => ({
  tierId: `tier-${index + 1}`,
  ...identity,
  requiredCount: validBadge.tiers[index].requiredCount,
  iconUrl: null,
}));
assert.equal(hasFixedBadgeTierStructure(fixedTierDefinitions), true);
assert.equal(hasFixedBadgeTierStructure(fixedTierDefinitions.slice(0, 3)), false, 'legacy tier count is incompatible');
assert.doesNotThrow(() => assertBadgeTierIdsStayWithLevels(fixedTierDefinitions, fixedTierDefinitions));
assert.throws(() => assertBadgeTierIdsStayWithLevels(fixedTierDefinitions, fixedTierDefinitions.map((tier, index) => ({
  ...tier,
  tierId: fixedTierDefinitions[(index + 1) % fixedTierDefinitions.length].tierId,
}))), /fixed level identities/i, 'tier IDs cannot be reordered');

assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tiers: fixedTierDefinitions.slice(0, 3),
  handlerRegistered: false,
}), 'ประเภทเงื่อนไขนี้ยังไม่มีตัวประมวลผลในระบบ');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'pending',
  conditionType: 'referral_count',
  tiers: fixedTierDefinitions,
  handlerRegistered: true,
}), 'ต้องกำหนดสถานะการพัฒนาเป็นพร้อมใช้งานก่อนเปิดเหรียญตรา');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tiers: fixedTierDefinitions.slice(0, 3),
  handlerRegistered: true,
}), 'เหรียญตราต้องมีระดับบรอนซ์ ซิลเวอร์ โกลด์ และแพลทินัมครบก่อนเปิดใช้งาน');
assert.equal(getBadgeActivationBlocker({
  implementationStatus: 'ready',
  conditionType: 'referral_count',
  tiers: fixedTierDefinitions,
  handlerRegistered: true,
}), null);

assert.doesNotThrow(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }]
));
assert.throws(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  []
), /earned achievement/i);
assert.throws(() => assertEarnedTiersUnchanged(
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 5, iconUrl: null }],
  [{ tierId: 'tier-1', tierName: 'Bronze', tierLevel: 1, requiredCount: 6, iconUrl: null }]
), /earned achievement/i);

async function testRegistry() {
  const registry = new BadgeConditionRegistry();
  assert.deepEqual(registry.listConditionTypes(), []);
  assert.equal(registry.has('review_count'), false);
  registry.register({ conditionType: 'review_count', getProgress: async () => 4 });
  assert.equal(registry.has('review_count'), true);
  assert.deepEqual(registry.listConditionTypes(), ['review_count']);
  assert.equal(await registry.getProgress('review_count', 'user-1'), 4);
  await assert.rejects(() => registry.getProgress('unregistered', 'user-1'), /not registered/i);
  registry.register({ conditionType: 'spend_total', getProgress: async () => Number.NaN });
  await assert.rejects(() => registry.getProgress('spend_total', 'user-1'), /invalid progress/i);
}

void testRegistry().then(() => console.log('Badge management unit checks passed'));
