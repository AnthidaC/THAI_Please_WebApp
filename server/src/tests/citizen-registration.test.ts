import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { isValidThaiCitizenId, getCitizenIdHmacSecret, hashCitizenId } from '../utils/citizen-id';
import { citizenRegisterSchema } from '../validations/auth.validation';
import { citizenRegisterRateLimit } from '../routes/auth.routes';
import { registerCitizen } from '../services/citizenAuth.service';
import { createCredentialLoginService, INVALID_CREDENTIALS_MESSAGE } from '../services/authLogin.service';
import { HttpError } from '../utils/http-error';
import { signMerchantApplicationStatusToken, signToken, verifyToken } from '../utils/jwt';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';

const listen = async (app: express.Express): Promise<Server> => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('Thai Citizen ID checksum validates correctly', () => {
  // Valid Mod-11 citizen ID (check digit 0)
  assert.equal(isValidThaiCitizenId('1101700203450'), true);
  // Invalid Mod-11 citizen ID (check digit 6 is invalid for this sequence)
  assert.equal(isValidThaiCitizenId('1101700203456'), false);
  // Invalid length
  assert.equal(isValidThaiCitizenId('110170020345'), false);
  assert.equal(isValidThaiCitizenId('11017002034500'), false);
  // Non-numeric
  assert.equal(isValidThaiCitizenId('110170020345A'), false);
});

test('citizen registration schema validates inputs and formats email', () => {
  const valid = citizenRegisterSchema.parse({
    fullName: ' สมชาย ใจดี ',
    citizenId: '1101700203450',
    provinceCode: '10',
    email: ' TEST.CITIZEN@Example.COM ',
    password: 'Password123!',
  });
  assert.equal(valid.fullName, 'สมชาย ใจดี');
  assert.equal(valid.email, 'test.citizen@example.com');
  assert.equal(valid.password, 'Password123!');

  // Rejects invalid checksum
  assert.throws(() => citizenRegisterSchema.parse({
    fullName: 'สมชาย',
    citizenId: '1101700203456',
    provinceCode: '10',
    email: 'test@example.com',
    password: 'Password123!',
  }));

  // Rejects password shorter than 8
  assert.throws(() => citizenRegisterSchema.parse({
    fullName: 'สมชาย',
    citizenId: '1101700203450',
    provinceCode: '10',
    email: 'test@example.com',
    password: 'short',
  }));

  // Rejects password longer than 72
  assert.throws(() => citizenRegisterSchema.parse({
    fullName: 'สมชาย',
    citizenId: '1101700203450',
    provinceCode: '10',
    email: 'test@example.com',
    password: 'a'.repeat(73),
  }));
});

test('HMAC secret behaves correctly across environments', (context) => {
  const originalSecret = process.env.CITIZEN_ID_HMAC_SECRET;
  const originalEnv = process.env.NODE_ENV;
  context.after(() => {
    if (originalSecret === undefined) delete process.env.CITIZEN_ID_HMAC_SECRET;
    else process.env.CITIZEN_ID_HMAC_SECRET = originalSecret;

    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  // 1. In development without secret, uses fixed fallback
  delete process.env.CITIZEN_ID_HMAC_SECRET;
  process.env.NODE_ENV = 'development';
  assert.equal(typeof getCitizenIdHmacSecret(), 'string');
  assert.ok(hashCitizenId('1101700203450'));

  // 2. In production without secret, fails closed with 503
  delete process.env.CITIZEN_ID_HMAC_SECRET;
  process.env.NODE_ENV = 'production';
  assert.throws(() => getCitizenIdHmacSecret(), (err: unknown) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.statusCode, 503);
    return true;
  });

  // 3. With explicit env secret, uses it
  process.env.CITIZEN_ID_HMAC_SECRET = 'super-secret-hmac-key';
  assert.equal(getCitizenIdHmacSecret(), 'super-secret-hmac-key');
});

test('citizen registration rate limit allows 5 attempts and blocks the 6th with 429', async (context) => {
  const app = express();
  app.post('/auth/register-citizen', citizenRegisterRateLimit, (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address() as AddressInfo;
  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const res = await fetch(`http://127.0.0.1:${address.port}/auth/register-citizen`, { method: 'POST' });
    statuses.push(res.status);
  }
  assert.deepEqual(statuses, [204, 204, 204, 204, 204, 429]);
});

test('citizen credential provider authenticates valid citizen and issues matching citizen token', async () => {
  const fakeCitizenProvider = async (email: string) => {
    if (email !== 'citizen@example.test') return null;
    return {
      passwordHash: 'hashed-secret',
      authenticate: async () => ({
        kind: 'authenticated' as const,
        data: {
          user: {
            id: 'citizen-uuid-1',
            email: 'citizen@example.test',
            name: 'สมชาย ใจดี',
            role: 'USER',
            createdAt: '2026-10-30T00:00:00.000Z',
          },
          token: signToken({ userId: 'citizen-uuid-1', role: 'CITIZEN' }),
        },
      }),
    };
  };

  const loginService = createCredentialLoginService(
    [fakeCitizenProvider],
    async (pass, hash) => pass === hash,
    async () => 'dummy-hash',
  );

  // Success login
  const outcome = await loginService('citizen@example.test', 'hashed-secret');
  assert.equal(outcome.kind, 'authenticated');
  if (outcome.kind === 'authenticated') {
    assert.equal(outcome.data.user.role, 'USER');
    assert.equal(outcome.data.user.name, 'สมชาย ใจดี');
    const payload = verifyToken(outcome.data.token);
    assert.equal(payload.userId, 'citizen-uuid-1');
    assert.equal(payload.role, 'CITIZEN');
  }

  // Wrong password returns same 401 error message as missing user
  await assert.rejects(
    () => loginService('citizen@example.test', 'wrong-pass'),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, INVALID_CREDENTIALS_MESSAGE);
      return true;
    },
  );

  // Missing email returns same 401 error message
  await assert.rejects(
    () => loginService('unknown@example.test', 'hashed-secret'),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.statusCode, 401);
      assert.equal(err.message, INVALID_CREDENTIALS_MESSAGE);
      return true;
    },
  );
});

test('status-only token is rejected on citizen endpoints', async (context) => {
  const app = express();
  app.get('/api/auth/me', authenticate, requireCitizen, (_req, res) => res.json({ status: 'success' }));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address() as AddressInfo;
  const statusToken = signMerchantApplicationStatusToken('some-app-id');

  const res = await fetch(`http://127.0.0.1:${address.port}/api/auth/me`, {
    headers: { Authorization: `Bearer ${statusToken}` },
  });
  assert.equal(res.status, 403);
});

test('registerCitizen rollback on failure and 409 collision detection', async () => {
  const calls: string[] = [];

  // Mock DB where citizen ID already exists
  const mockDbDuplicateCitizen: any = {
    $transaction: async (fn: any) => {
      return fn({
        user: {
          findUnique: async () => ({ user_id: 'existing-id' }),
        },
      });
    },
  };

  await assert.rejects(
    () => registerCitizen({
      fullName: 'ทดสอบ',
      citizenId: '1101700203450',
      provinceCode: '10',
      email: 'new@example.com',
      password: 'Password123!',
    }, mockDbDuplicateCitizen),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.statusCode, 409);
      assert.equal(err.message, 'เลขประจำตัวประชาชนนี้ถูกลงทะเบียนแล้ว');
      return true;
    },
  );

  // Mock DB where email already exists across any account type
  const mockDbDuplicateEmail: any = {
    $transaction: async (fn: any) => {
      return fn({
        user: {
          findUnique: async () => null,
        },
        auth_identities: {
          findUnique: async () => ({ email: 'new@example.com' }),
        },
      });
    },
  };

  await assert.rejects(
    () => registerCitizen({
      fullName: 'ทดสอบ',
      citizenId: '1101700203450',
      provinceCode: '10',
      email: 'new@example.com',
      password: 'Password123!',
    }, mockDbDuplicateEmail),
    (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.statusCode, 409);
      assert.equal(err.message, 'อีเมลนี้ถูกใช้งานแล้วในระบบ');
      return true;
    },
  );

  // Mock DB verifying full transaction creation flow
  const mockDbSuccess: any = {
    $transaction: async (fn: any) => {
      return fn({
        user: {
          findUnique: async () => null,
          create: async (args: any) => {
            calls.push('user.create');
            return {
              user_id: 'new-user-uuid',
              full_name: args.data.full_name,
              citizen_id_hash: args.data.citizen_id_hash,
              province_code: args.data.province_code,
              created_at: new Date('2026-10-30T00:00:00.000Z'),
            };
          },
        },
        auth_identities: {
          findUnique: async () => null,
          create: async (args: any) => {
            calls.push('auth_identities.create');
            assert.equal(args.data.account_type, 'CITIZEN_ACCOUNT');
            assert.equal(args.data.account_id, 'new-user-uuid');
            assert.equal(args.data.email, 'valid@example.com');
            return args.data;
          },
        },
        campaigns: {
          findFirst: async () => ({
            campaign_id: 'camp-1',
            start_date: new Date('2026-01-01'),
            end_date: new Date('2026-12-31'),
            daily_quota_limit: 200,
            total_quota_limit: 3000,
          }),
        },
        wallets: {
          create: async (args: any) => {
            calls.push('wallets.create');
            assert.equal(args.data.user_id, 'new-user-uuid');
            assert.equal(args.data.balance, 2000);
            assert.equal(args.data.daily_quota_limit, 200);
            assert.equal(args.data.total_quota_remaining, 3000);
            assert.equal(args.data.eligibility_status, 'ELIGIBLE');
            return args.data;
          },
        },
        citizen_credentials: {
          create: async (args: any) => {
            calls.push('citizen_credentials.create');
            assert.equal(args.data.user_id, 'new-user-uuid');
            assert.ok(args.data.password_hash);
            assert.notEqual(args.data.password_hash, 'Password123!');
            return args.data;
          },
        },
      });
    },
  };

  const registered = await registerCitizen({
    fullName: 'สมชาย ใจดี',
    citizenId: '1101700203450',
    provinceCode: '10',
    email: 'VALID@example.com',
    password: 'Password123!',
  }, mockDbSuccess);

  assert.deepEqual(calls, [
    'user.create',
    'wallets.create',
    'citizen_credentials.create',
    'auth_identities.create',
  ]);
  assert.equal(registered.id, 'new-user-uuid');
  assert.equal(registered.email, 'valid@example.com');
  assert.equal(registered.role, 'USER');
});

