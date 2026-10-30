import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import provinces from '../src/data/thai-address/provinces.json';
import {
  citizenProvinceOptions,
  isValidThaiCitizenId,
} from '../src/utils/thaiCitizenId';

const storage = new Map<string, string>();
if (!('localStorage' in globalThis) || !(globalThis as any).localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
      clear: () => { storage.clear(); },
    },
  });
}

const validCitizenId = (firstTwelve: string): string => {
  const sum = [...firstTwelve].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return `${firstTwelve}${(11 - (sum % 11)) % 10}`;
};

test('Thai citizen ID accepts any 13-digit number and rejects invalid length or non-digits', () => {
  assert.equal(isValidThaiCitizenId('1234567890123'), true);
  assert.equal(isValidThaiCitizenId('1101700203450'), true);
  assert.equal(isValidThaiCitizenId('12345678901'), false);
  assert.equal(isValidThaiCitizenId('12345678901234'), false);
  assert.equal(isValidThaiCitizenId('123456789012A'), false);
});

test('citizen province choices come from the same source and formatting as Merchant registration', () => {
  assert.deepEqual(citizenProvinceOptions, provinces.map((province) => ({
    code: String(province.provinceCode).padStart(2, '0'),
    name: province.provinceNameTh,
  })));
});

test('registration page renders citizen registration form in all environments', async () => {
  const { RegisterPage } = await import('../src/pages/auth/RegisterPage');
  const markup = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(RegisterPage),
    ),
  );
  assert.match(markup, /สมัครสมาชิกประชาชน/);
  assert.match(markup, /citizen-id/);
  assert.match(markup, /citizen-full-name/);
});
