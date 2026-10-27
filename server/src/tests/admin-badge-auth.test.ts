import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { signToken } from '../utils/jwt';

const invoke = (authorization?: string) => {
  let statusCode = 200;
  let body: unknown;
  let nextCalled = false;
  const req = {
    headers: { ...(authorization && { authorization }) },
    body: { role: 'ADMIN' },
  } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  authenticateAdmin(req, res, () => { nextCalled = true; });
  return { statusCode, body, nextCalled };
};

assert.equal(invoke().statusCode, 401, 'client-supplied role must not authenticate an Admin request');
assert.equal(invoke(`Bearer ${signToken({ userId: 'citizen-1', role: 'CITIZEN' })}`).statusCode, 403);
assert.equal(invoke(`Bearer ${signToken({ userId: 'admin-1', role: 'ADMIN' })}`).nextCalled, true);

console.log('Admin Badge authorization checks passed');
