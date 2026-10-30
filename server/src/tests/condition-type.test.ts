import assert from 'node:assert/strict';
import { BadgeConditionRegistry } from '../services/achievements/conditionRegistry';
import { registerAchievementHandlers } from '../services/achievements/handlers';
import {
  conditionTypeCreateSchema,
  conditionTypeListQuerySchema,
  conditionTypeUpdateSchema,
} from '../validations/condition-type.validation';

const validCreate = conditionTypeCreateSchema.safeParse({
  conditionKey: 'merchant_visit_count',
  displayName: 'จำนวนร้านค้าที่ใช้บริการ',
  description: 'นับจำนวนร้านค้าที่ผู้ใช้เคยทำรายการสำเร็จ',
  measurementUnit: 'count',
});
assert.equal(validCreate.success, true, 'a valid condition definition is accepted');
assert.equal(conditionTypeCreateSchema.safeParse({
  conditionKey: 'new_spending_type',
  displayName: 'ยอดใช้จ่าย',
  measurementUnit: 'amount',
  implementationStatus: 'ready',
}).success, false, 'creation cannot claim implementation status');
assert.equal(conditionTypeUpdateSchema.safeParse({
  conditionKey: 'renamed_key',
  displayName: 'ชื่อใหม่',
}).success, false, 'the condition key is immutable');
assert.equal(conditionTypeUpdateSchema.safeParse({ displayName: 'ยอดใช้จ่าย' }).success, true);
assert.equal(conditionTypeListQuerySchema.safeParse({ implementation_status: 'pending', handler_registered: 'false' }).success, true);

const registry = new BadgeConditionRegistry();
registerAchievementHandlers(registry);
assert.deepEqual(registry.listConditionTypes(), [
  'referral_count',
  'review_count',
  'total_spending',
  'transaction_count',
], 'condition discovery uses the registered handlers');
assert.equal(registry.has('merchant_visit_count'), false, 'a catalog proposal does not install executable code');

console.log('Condition type validation and registry tests passed.');
