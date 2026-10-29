import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updatePreferencesSchema, preferenceItemSchema } from '../validations/preference.validation';

// =========================================================================
// 🧪 DEVELOPER 3: UC 2.5.3 PREFERENCE VALIDATION & DTO AUDIT TESTS
// =========================================================================

test('PreferenceItem: Valid categoryId and preferenceWeight pass validation', () => {
  const valid = preferenceItemSchema.safeParse({
    categoryId: 'STREET_FOOD',
    preferenceWeight: 1.0,
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.categoryId, 'STREET_FOOD');
    assert.equal(valid.data.preferenceWeight, 1.0);
  }
});

test('PreferenceItem: Default preferenceWeight is 1.0 when omitted', () => {
  const result = preferenceItemSchema.safeParse({
    categoryId: 'BEVERAGE',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.preferenceWeight, 1.0);
  }
});

test('PreferenceItem: Invalid categoryId (empty, non-canonical, special characters) is rejected', () => {
  const empty = preferenceItemSchema.safeParse({ categoryId: '' });
  assert.equal(empty.success, false);

  const nonCanonical = preferenceItemSchema.safeParse({ categoryId: 'A_LA_CARTE' });
  assert.equal(nonCanonical.success, false);

  const pluralNonCanonical = preferenceItemSchema.safeParse({ categoryId: 'BEVERAGES' });
  assert.equal(pluralNonCanonical.success, false);

  const specialChars = preferenceItemSchema.safeParse({ categoryId: 'FOOD & DRINKS <script>' });
  assert.equal(specialChars.success, false);

  const tooLong = preferenceItemSchema.safeParse({ categoryId: 'a'.repeat(51) });
  assert.equal(tooLong.success, false);
});

test('PreferenceItem: All 5 canonical categories are accepted', () => {
  const canonicalIds = ['FOOD', 'STREET_FOOD', 'BAKERY_DESSERT', 'BEVERAGE', 'GENERAL_GOODS'];
  for (const id of canonicalIds) {
    const res = preferenceItemSchema.safeParse({ categoryId: id });
    assert.equal(res.success, true, `Expected ${id} to be valid`);
  }
});

test('PreferenceItem: Invalid preferenceWeight (<0.0 or >9.99) is rejected', () => {
  const negative = preferenceItemSchema.safeParse({
    categoryId: 'STREET_FOOD',
    preferenceWeight: -0.5,
  });
  assert.equal(negative.success, false);

  const exceed = preferenceItemSchema.safeParse({
    categoryId: 'STREET_FOOD',
    preferenceWeight: 10.0,
  });
  assert.equal(exceed.success, false);
});

test('UpdatePreferencesPayload: Rejects duplicate category IDs in payload array', () => {
  const duplicate = updatePreferencesSchema.safeParse({
    preferences: [
      { categoryId: 'STREET_FOOD', preferenceWeight: 1.0 },
      { categoryId: 'street_food', preferenceWeight: 1.5 }, // Case-insensitive duplicate check
    ],
  });
  assert.equal(duplicate.success, false);
  if (!duplicate.success) {
    assert.match(duplicate.error.issues[0].message, /ซ้ำซ้อน/);
  }
});

test('UpdatePreferencesPayload: Accepts empty array (user deselects all preferences)', () => {
  const emptyList = updatePreferencesSchema.safeParse({
    preferences: [],
  });
  assert.equal(emptyList.success, true);
  if (emptyList.success) {
    assert.equal(emptyList.data.preferences.length, 0);
  }
});

test('UpdatePreferencesPayload: Accepts unique list of valid canonical category items', () => {
  const uniqueList = updatePreferencesSchema.safeParse({
    preferences: [
      { categoryId: 'STREET_FOOD', preferenceWeight: 1.0 },
      { categoryId: 'FOOD', preferenceWeight: 1.2 },
      { categoryId: 'BEVERAGE', preferenceWeight: 0.8 },
    ],
  });
  assert.equal(uniqueList.success, true);
  if (uniqueList.success) {
    assert.equal(uniqueList.data.preferences.length, 3);
  }
});
