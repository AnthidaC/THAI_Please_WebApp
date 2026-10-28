import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { createDemoLoginHandler } from '../controllers/auth.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { authenticatePaymentSession } from '../middlewares/payment-access.middleware';
import { signToken } from '../utils/jwt';

const citizenId = 'c7d8e58d-117c-4e52-9d25-20b5899d7e25';
const merchantId = '11e7d97c-058c-409c-a8d1-dcefa07cc265';
const adminId = '20f088d4-e249-4fce-a69f-7e745863fd52';
const unknownId = 'd43ba026-ef3e-43f4-aaf6-0a5bb6df8e42';
const accounts = {
  CITIZEN: { id: citizenId, name: 'Synthetic Citizen', createdAt: new Date('2026-10-01T00:00:00.000Z') },
  MERCHANT: { id: merchantId, name: 'Synthetic Shop', createdAt: new Date('2026-10-02T00:00:00.000Z') },
  ADMIN: { id: adminId, name: 'Synthetic Admin', createdAt: new Date('2026-10-03T00:00:00.000Z') },
};

type DemoLoginOptions = Parameters<typeof createDemoLoginHandler>[0];
type LoginBody = { role?: string; accountId?: string };

const invoke = async (options: DemoLoginOptions, body: LoginBody) => {
  let statusCode = 200;
  let responseBody: any;
  let nextError: unknown;
  const req = { body } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { responseBody = value; return this; },
  } as unknown as Response;
  await createDemoLoginHandler(options)(req, res, (error?: unknown) => { nextError = error; });
  return { statusCode, body: responseBody, nextError };
};

const invokeMiddleware = async (
  middleware: (req: Request, res: Response, next: (error?: unknown) => void) => unknown,
  token: string
) => {
  let statusCode = 200;
  let nextCalled = false;
  let user: Request['user'];
  const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
  const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } } as unknown as Response;
  await middleware(req, res, () => { nextCalled = true; });
  user = req.user;
  return { statusCode, nextCalled, user };
};

const options = (overrides: Partial<DemoLoginOptions> = {}): DemoLoginOptions => ({
  allowedAccountIds: {
    CITIZEN: [citizenId],
    MERCHANT: [merchantId],
    ADMIN: [adminId],
  },
  findAccount: async (role, accountId) => accounts[role].id === accountId ? accounts[role] : null,
  issueToken: signToken,
  ...overrides,
});

test('mock login rejects roles with no configured test account', async () => {
  let lookupCount = 0;
  const findAccount = async () => { lookupCount += 1; return accounts.CITIZEN; };
  const result = await invoke(options({
    allowedAccountIds: { CITIZEN: [], MERCHANT: [], ADMIN: [] },
    findAccount,
  }), { role: 'CITIZEN' });
  assert.equal(result.statusCode, 404);
  assert.equal(lookupCount, 0);
});

test('mock login rejects unknown roles, unlisted accounts, and unconfigured roles', async () => {
  assert.equal((await invoke(options(), { role: 'OWNER' })).statusCode, 400);
  assert.equal((await invoke(options(), { role: 'MERCHANT', accountId: unknownId })).statusCode, 403);
  assert.equal((await invoke(options({ allowedAccountIds: { CITIZEN: [citizenId], MERCHANT: [], ADMIN: [adminId] } }), { role: 'MERCHANT' })).statusCode, 404);
});

test('mock login requires a selected allowlisted account when a role has several', async () => {
  let lookupCount = 0;
  const configured = options({
    allowedAccountIds: { CITIZEN: [citizenId, unknownId], MERCHANT: [merchantId], ADMIN: [adminId] },
    findAccount: async (role, accountId) => {
      lookupCount += 1;
      return accounts[role].id === accountId ? accounts[role] : null;
    },
  });
  assert.equal((await invoke(configured, { role: 'CITIZEN' })).statusCode, 403);
  assert.equal(lookupCount, 0, 'the handler must not choose or look up an account when selection is ambiguous');
  assert.equal((await invoke(configured, { role: 'CITIZEN', accountId: citizenId })).statusCode, 200);
  assert.equal((await invoke(configured, { role: 'CITIZEN', accountId: merchantId })).statusCode, 403);
});

test('configured IDs must resolve to usable accounts', async () => {
  const result = await invoke(options({ findAccount: async () => null }), { role: 'ADMIN' });
  assert.equal(result.statusCode, 404);
});

test('Citizen, Merchant, and Admin mock accounts receive expiring signed role tokens', async () => {
  const expected = [
    { role: 'CITIZEN', account: accounts.CITIZEN, uiRole: 'USER' },
    { role: 'MERCHANT', account: accounts.MERCHANT, uiRole: 'MERCHANT' },
    { role: 'ADMIN', account: accounts.ADMIN, uiRole: 'ADMIN' },
  ] as const;

  for (const entry of expected) {
    const result = await invoke(options(), { role: entry.role });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.user.id, entry.account.id);
    assert.equal(result.body.data.user.name, entry.account.name);
    assert.equal(result.body.data.user.role, entry.uiRole);
    assert.equal('password_hash' in result.body.data.user, false);

    const payload = jwt.verify(result.body.data.token, env.JWT_SECRET) as jwt.JwtPayload;
    assert.equal(payload.userId, entry.account.id);
    assert.equal(payload.role, entry.role);
    assert.equal(payload.isDemo, true);
    assert.ok(payload.exp && payload.exp > Math.floor(Date.now() / 1000));
  }
});

test('signed mock sessions pass the existing Admin and Merchant authentication middleware', async () => {
  const adminLogin = await invoke(options(), { role: 'ADMIN' });
  const merchantLogin = await invoke(options(), { role: 'MERCHANT' });

  const admin = await invokeMiddleware(authenticateAdmin, adminLogin.body.data.token);
  const merchant = await invokeMiddleware(authenticatePaymentSession, merchantLogin.body.data.token);

  assert.deepEqual({ statusCode: admin.statusCode, nextCalled: admin.nextCalled, role: admin.user?.role }, {
    statusCode: 200,
    nextCalled: true,
    role: 'ADMIN',
  });
  assert.deepEqual({ statusCode: merchant.statusCode, nextCalled: merchant.nextCalled, role: merchant.user?.role }, {
    statusCode: 200,
    nextCalled: true,
    role: 'MERCHANT',
  });
});

test('static legacy demo tokens do not authenticate Admin or Merchant APIs', async () => {
  for (const [middleware, token] of [
    [authenticateAdmin, 'demo-token-admin'],
    [authenticatePaymentSession, 'demo-token-merchant'],
    [authenticatePaymentSession, 'demo-token'],
  ] as const) {
    const result = await invokeMiddleware(middleware, token);
    assert.equal(result.statusCode, 401);
    assert.equal(result.nextCalled, false);
  }
});
