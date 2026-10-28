import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createDemoCitizenLoginHandler } from '../controllers/auth.controller';
import { authenticatePaymentSession } from '../middlewares/payment-access.middleware';
import { signToken } from '../utils/jwt';

const allowedId = 'c7d8e58d-117c-4e52-9d25-20b5899d7e25';
const unknownId = 'd43ba026-ef3e-43f4-aaf6-0a5bb6df8e42';
const syntheticUser = {
  user_id: allowedId,
  full_name: 'Synthetic Citizen',
  created_at: new Date('2026-10-01T00:00:00.000Z'),
};

const invoke = async (
  options: Parameters<typeof createDemoCitizenLoginHandler>[0],
  userId?: string
) => {
  let statusCode = 200;
  let body: any;
  let nextError: unknown;
  const req = { body: userId ? { userId } : {} } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  await createDemoCitizenLoginHandler(options)(req, res, (error?: unknown) => { nextError = error; });
  return { statusCode, body, nextError };
};

const options = (overrides: Partial<Parameters<typeof createDemoCitizenLoginHandler>[0]> = {}) => ({
  nodeEnv: 'development',
  enabled: true,
  allowedUserIds: [allowedId],
  findUserById: async (userId: string) => userId === allowedId ? syntheticUser : null,
  issueToken: signToken,
  ...overrides,
});

test('demo login is unavailable when disabled', async () => {
  let lookupCount = 0;
  const result = await invoke(options({ enabled: false, findUserById: async () => { lookupCount++; return syntheticUser; } }));
  assert.equal(result.statusCode, 404);
  assert.equal(lookupCount, 0);
});

test('demo login is unavailable in production', async () => {
  const result = await invoke(options({ nodeEnv: 'production' }));
  assert.equal(result.statusCode, 404);
});

test('demo login rejects account IDs outside the server allowlist', async () => {
  let lookupCount = 0;
  const result = await invoke(options({ findUserById: async () => { lookupCount++; return syntheticUser; } }), unknownId);
  assert.equal(result.statusCode, 403);
  assert.equal(lookupCount, 0);
});

test('demo login requires an explicit allowlisted choice when several accounts are configured', async () => {
  const result = await invoke(options({ allowedUserIds: [allowedId, unknownId] }));
  assert.equal(result.statusCode, 403);
});

test('demo login rejects allowlisted accounts that do not exist', async () => {
  const result = await invoke(options({ findUserById: async () => null }));
  assert.equal(result.statusCode, 404);
});

test('authorized synthetic Citizen receives a normal signed, expiring Citizen JWT', async () => {
  let queriedId: string | undefined;
  const result = await invoke(options({ findUserById: async (userId) => { queriedId = userId; return syntheticUser; } }));

  assert.equal(result.statusCode, 200);
  assert.equal(queriedId, allowedId);
  assert.equal(result.body.data.user.id, allowedId);
  assert.equal(result.body.data.user.role, 'USER');
  assert.equal(result.body.data.user.name, 'Synthetic Citizen');
  assert.equal('citizen_id_hash' in result.body.data.user, false);
  assert.equal('wallets' in result.body.data.user, false);

  const payload = jwt.verify(result.body.data.token, env.JWT_SECRET) as jwt.JwtPayload;
  assert.equal(payload.userId, allowedId);
  assert.equal(payload.role, 'CITIZEN');
  assert.equal(payload.isDemo, true);
  assert.ok(payload.exp && payload.exp > Math.floor(Date.now() / 1000));
});

test('legacy static Citizen demo tokens no longer resolve to the first database user', async () => {
  let statusCode = 200;
  let nextCalled = false;
  const req = { headers: { authorization: 'Bearer demo-token-citizen' } } as unknown as Request;
  const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } } as unknown as Response;
  await authenticatePaymentSession(req, res, () => { nextCalled = true; });
  assert.equal(statusCode, 401);
  assert.equal(nextCalled, false);
});
