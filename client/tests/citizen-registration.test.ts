import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import provinces from '../src/data/thai-address/provinces.json';
import {
  citizenProvinceOptions,
  isValidThaiCitizenId,
  submitCitizenRegistrationMock,
} from '../src/services/citizenRegistrationMock';
import type { CitizenRegistrationDraft } from '../src/services/citizenRegistrationMock';

const validCitizenId = (firstTwelve: string): string => {
  const sum = [...firstTwelve].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return `${firstTwelve}${(11 - (sum % 11)) % 10}`;
};

test('Thai citizen ID checksum accepts a valid 13-digit number and rejects an invalid one', () => {
  const validId = validCitizenId('123456789012');
  assert.equal(isValidThaiCitizenId(validId), true);
  assert.equal(isValidThaiCitizenId(`${validId.slice(0, 12)}${(Number(validId[12]) + 1) % 10}`), false);
  assert.equal(isValidThaiCitizenId('12345678901'), false);
});

test('citizen province choices come from the same source and formatting as Merchant registration', () => {
  assert.deepEqual(citizenProvinceOptions, provinces.map((province) => ({
    code: String(province.provinceCode).padStart(2, '0'),
    name: province.provinceNameTh,
  })));
});

test('production registration page renders the existing placeholder and no form', async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  });

  try {
    const { RegisterPageContent } = await import('../src/pages/auth/RegisterPage');
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(RegisterPageContent, { isDevelopment: false }),
      ),
    );
    assert.match(markup, /การสร้างบัญชีใหม่ยังไม่เปิดใช้/);
    assert.doesNotMatch(markup, /<form|citizen-id|citizen-password/);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('mock registration clears sensitive form state before using the existing Citizen demo login', async () => {
  const draft: CitizenRegistrationDraft = {
    fullName: 'Demo Citizen',
    citizenId: validCitizenId('123456789012'),
    provinceCode: '10',
    email: 'dev-citizen@example.test',
    password: 'DevOnlyPass123!',
  };
  let sensitiveState = { citizenId: draft.citizenId, password: draft.password, confirmation: draft.password };
  const loginCalls: Array<{ role: string; accountId: string | undefined }> = [];
  const login = async (role: 'CITIZEN' | 'MERCHANT' | 'ADMIN', accountId?: string) => {
    assert.deepEqual(sensitiveState, { citizenId: '', password: '', confirmation: '' });
    loginCalls.push({ role, accountId });
    return {
      status: 'success' as const,
      data: {
        user: { id: 'demo-user', role: 'USER' as const, createdAt: '2026-10-30T00:00:00.000Z' },
        token: 'mock-citizen-token',
      },
    };
  };

  const result = await submitCitizenRegistrationMock(
    draft,
    () => { sensitiveState = { citizenId: '', password: '', confirmation: '' }; },
    'citizen-test-account',
    login,
  );

  assert.deepEqual(loginCalls, [{ role: 'CITIZEN', accountId: 'citizen-test-account' }]);
  assert.equal(result.data.user.role, 'USER');
  assert.deepEqual(sensitiveState, { citizenId: '', password: '', confirmation: '' });
});
