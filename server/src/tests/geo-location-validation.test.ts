import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import geoRouter from '../routes/geo.routes';
import { merchantApplicationSchema } from '../validations/merchant-application.validation';

const listen = async (app: express.Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

test('GET /api/geo/ip-location returns null for loopback and private IP safely', async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/geo', geoRouter);

  const server = await listen(app);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/geo/ip-location`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    // Because it's called from loopback/localhost, it must return null coordinates
    assert.equal(data.data.latitude, null);
    assert.equal(data.data.longitude, null);
  } finally {
    server.close();
  }
});

test('merchantApplicationSchema validates coordinates within Thailand boundaries', () => {
  const validBase = {
    businessType: 'INDIVIDUAL',
    taxId: '1234567890123',
    businessName: 'ร้านชาไทย สบายใจ',
    contactName: 'นายสมชาย ใจดี',
    email: 'somchai.shop@example.com',
    phone: '0812345678',
    password: 'Password123!',
    address: '99/1 ถ.สุขุมวิท คลองเตย กรุงเทพมหานคร 10110',
    latitude: 13.7563, // Bangkok (valid)
    longitude: 100.5018,
  };

  // Valid coordinates in Thailand should parse successfully
  const parsed = merchantApplicationSchema.safeParse(validBase);
  assert.equal(parsed.success, true);

  // String coordinates should be coerced by toCoordinate preprocessor
  const parsedFromString = merchantApplicationSchema.safeParse({
    ...validBase,
    latitude: '18.7883', // Chiang Mai
    longitude: '98.9853',
  });
  assert.equal(parsedFromString.success, true);
  if (parsedFromString.success) {
    assert.equal(parsedFromString.data.latitude, 18.7883);
    assert.equal(parsedFromString.data.longitude, 98.9853);
  }

  // Coordinates outside Thailand (e.g. Tokyo, Japan: lat 35.6762, lng 139.6503) should be rejected
  const outsideParsed = merchantApplicationSchema.safeParse({
    ...validBase,
    latitude: 35.6762,
    longitude: 139.6503,
  });
  assert.equal(outsideParsed.success, false);
  if (!outsideParsed.success) {
    const errorMessages = outsideParsed.error.issues.map((i) => i.message);
    assert.ok(
      errorMessages.some((msg) => msg.includes('ตำแหน่งร้านต้องอยู่ในประเทศไทย กรุณาเลื่อนหมุดให้ตรงที่ตั้งร้าน')),
      'Expected friendly error message for coordinates outside Thailand'
    );
  }
});
