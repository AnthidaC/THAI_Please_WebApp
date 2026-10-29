import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { signToken } from '../utils/jwt';

const invoke = async (authorization?: string) => {
  let statusCode = 200;
  let body: unknown;
  let nextCalled = false;
  const req = { headers: { ...(authorization && { authorization }) } } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;

  await authenticate(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled, user: req.user };
};

const invokeRequireCitizen = (role?: string) => {
  let statusCode = 200;
  let nextCalled = false;
  const req = { user: role ? { userId: 'citizen-1', role } : undefined } as unknown as Request;
  const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } } as unknown as Response;
  requireCitizen(req, res, () => { nextCalled = true; });
  return { statusCode, nextCalled };
};

test('rejects requests without an authorization token', async () => {
  const result = await invoke();
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('rejects malformed and invalid bearer tokens', async () => {
  assert.equal((await invoke('Basic abc')).statusCode, 401);
  assert.equal((await invoke('Bearer')).statusCode, 401);
  assert.equal((await invoke('Bearer invalid-token')).statusCode, 401);
});

test('rejects an expired signed JWT', async () => {
  const token = jwt.sign({ userId: 'citizen-1', role: 'CITIZEN', exp: Math.floor(Date.now() / 1000) - 5 }, env.JWT_SECRET);
  const result = await invoke(`Bearer ${token}`);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('rejects a JWT signed with a different key', async () => {
  const token = jwt.sign({ userId: 'citizen-1', role: 'CITIZEN' }, `${env.JWT_SECRET}-wrong`);
  const result = await invoke(`Bearer ${token}`);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('rejects a tampered signed JWT', async () => {
  const parts = signToken({ userId: 'citizen-1', role: 'CITIZEN' }).split('.');
  const last = parts[2].at(-1);
  parts[2] = `${parts[2].slice(0, -1)}${last === 'a' ? 'b' : 'a'}`;
  const result = await invoke(`Bearer ${parts.join('.')}`);
  assert.equal(result.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('resolves a valid Citizen JWT to the signed identity', async () => {
  const token = signToken({ userId: 'synthetic-citizen-1', role: 'CITIZEN' });
  const result = await invoke(`Bearer ${token}`);
  assert.equal(result.statusCode, 200);
  assert.equal(result.nextCalled, true);
  assert.equal(result.user?.userId, 'synthetic-citizen-1');
  assert.equal(result.user?.role, 'CITIZEN');
});

test('Citizen APIs reject missing identity and non-Citizen roles', () => {
  assert.deepEqual(invokeRequireCitizen(), { statusCode: 401, nextCalled: false });
  assert.deepEqual(invokeRequireCitizen('ADMIN'), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invokeRequireCitizen('MERCHANT'), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invokeRequireCitizen('CITIZEN'), { statusCode: 200, nextCalled: true });
});

test('Admin authorization remains role-bound and rejects Citizen sessions', () => {
  let citizenStatus = 200;
  let adminAccepted = false;
  const response = { status(code: number) { citizenStatus = code; return this; }, json() { return this; } } as unknown as Response;
  const citizenRequest = {
    headers: { authorization: `Bearer ${signToken({ userId: 'citizen-1', role: 'CITIZEN' })}` },
  } as unknown as Request;
  authenticateAdmin(citizenRequest, response, () => { adminAccepted = true; });
  assert.equal(citizenStatus, 403);
  assert.equal(adminAccepted, false);

  const adminRequest = {
    headers: { authorization: `Bearer ${signToken({ userId: 'admin-1', role: 'ADMIN' })}` },
  } as unknown as Request;
  authenticateAdmin(adminRequest, response, () => { adminAccepted = true; });
  assert.equal(adminAccepted, true);
});
