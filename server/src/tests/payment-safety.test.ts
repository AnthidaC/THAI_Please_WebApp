import assert from 'node:assert/strict';
import { test } from 'node:test';
import { thaiDateKey, thaiDayRange } from '../utils/thai-date';
import { checkoutCopaySchema, setPaymentPinSchema } from '../validations/payment.validation';
import { hashPassword, comparePassword } from '../utils/bcrypt';

test('Thai midnight rolls over at 17:00 UTC, independently of the host timezone', () => {
  assert.equal(thaiDateKey(new Date('2026-10-27T16:59:59Z')), '2026-10-27');
  assert.equal(thaiDateKey(new Date('2026-10-27T17:00:00Z')), '2026-10-28');
  const { start, end } = thaiDayRange(new Date('2026-10-27T19:00:00Z'));
  assert.equal(start.toISOString(), '2026-10-27T17:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-28T17:00:00.000Z');
});

test('Checkout requires a six digit PIN; no omitted or malformed PIN bypass', () => {
  const body = { qrReference: 'test-qr', userLatitude: 13.75, userLongitude: 100.5 };
  for (const pin of [undefined, '', '12345', '1234567', 'abcdef']) {
    assert.equal(checkoutCopaySchema.safeParse({ ...body, pin }).success, false);
  }
  assert.equal(checkoutCopaySchema.safeParse({ ...body, pin: '012345' }).success, true);
});

test('PIN setup requires matching confirmation', () => {
  assert.equal(setPaymentPinSchema.safeParse({ pin: '012345', confirmPin: '999999' }).success, false);
  assert.equal(setPaymentPinSchema.safeParse({ pin: '012345', confirmPin: '012345' }).success, true);
});

test('PIN hashing is salted and never stores the six digits directly', async () => {
  const [a, b] = await Promise.all([hashPassword('012345'), hashPassword('012345')]);
  assert.notEqual(a, '012345'); assert.notEqual(a, b);
  assert.equal(await comparePassword('012345', a), true);
  assert.equal(await comparePassword('012346', a), false);
});
