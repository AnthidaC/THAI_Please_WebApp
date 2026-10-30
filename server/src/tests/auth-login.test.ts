import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createAuthLoginHandler } from '../controllers/auth.controller';
import {
  ACCOUNT_COLLISION_MESSAGE,
  CredentialCandidate,
  CredentialLoginOutcome,
  CredentialProvider,
  createCredentialLoginService,
  INVALID_CREDENTIALS_MESSAGE,
} from '../services/authLogin.service';
import { HttpError } from '../utils/http-error';
import { authLoginRateLimit, developmentOnlyDemoLogin } from '../routes/auth.routes';

const authenticated = (id: string, role: string): CredentialLoginOutcome => ({
  kind: 'authenticated',
  data: {
    user: {
      id,
      email: `${id}@example.test`,
      name: id,
      role,
      createdAt: '2026-10-30T00:00:00.000Z',
      ...(role === 'MERCHANT' ? { merchantApprovalStatus: 'APPROVED' as const } : {}),
    },
    token: `${role.toLowerCase()}-signed-token`,
  },
});

const candidate = (passwordHash: string, outcome: CredentialLoginOutcome): CredentialCandidate => ({
  passwordHash,
  authenticate: async () => outcome,
});

const verifyByExactMatch = async (password: string, hash: string): Promise<boolean> => password === hash;
const dummyHash = async (): Promise<string> => 'dummy-password-hash';

const invokeLogin = async (login: (email: string, password: string) => Promise<CredentialLoginOutcome>, password: string) => {
  try {
    return { statusCode: 200, body: await login('account@example.test', password) };
  } catch (error) {
    if (error instanceof HttpError) return { statusCode: error.statusCode, body: { message: error.message } };
    throw error;
  }
};

test('credential login returns the matched approved Merchant and Admin accounts', async () => {
  const merchantProvider: CredentialProvider = async () => candidate('merchant-pass', authenticated('merchant-1', 'MERCHANT'));
  const adminProvider: CredentialProvider = async () => null;
  const merchantLogin = createCredentialLoginService([merchantProvider, adminProvider], verifyByExactMatch, dummyHash);
  const merchantResult = await merchantLogin('merchant@example.test', 'merchant-pass');
  assert.equal(merchantResult.kind, 'authenticated');
  if (merchantResult.kind === 'authenticated') {
    assert.equal(merchantResult.data.user.role, 'MERCHANT');
    assert.equal(merchantResult.data.user.merchantApprovalStatus, 'APPROVED');
  }

  const noMerchantProvider: CredentialProvider = async () => null;
  const staffProvider: CredentialProvider = async () => candidate('admin-pass', authenticated('admin-1', 'ADMIN'));
  const adminLogin = createCredentialLoginService([noMerchantProvider, staffProvider], verifyByExactMatch, dummyHash);
  const adminResult = await adminLogin('admin@example.test', 'admin-pass');
  assert.equal(adminResult.kind, 'authenticated');
  if (adminResult.kind === 'authenticated') assert.equal(adminResult.data.user.role, 'ADMIN');
});

test('Merchant PENDING and REJECTED credentials return a scoped status token outcome', async () => {
  for (const applicationStatus of ['PENDING', 'REJECTED'] as const) {
    const provider: CredentialProvider = async () => candidate('merchant-pass', {
      kind: 'application-status',
      applicationStatus,
      token: 'merchant-status-token',
    });
    const login = createCredentialLoginService([provider], verifyByExactMatch, dummyHash);
    assert.deepEqual(await login('merchant@example.test', 'merchant-pass'), {
      kind: 'application-status',
      applicationStatus,
      token: 'merchant-status-token',
    });
  }
});

test('login controller returns Merchant status with its scoped status token', async (context) => {
  const app = express();
  app.use(express.json());
  app.post('/auth/login', createAuthLoginHandler(async () => ({
    kind: 'application-status',
    applicationStatus: 'PENDING',
    token: 'merchant-status-token',
  })));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'merchant@example.test', password: 'pass' }),
  });
  const body: unknown = await response.json();

  assert.equal(response.status, 403);
  assert.deepEqual(body, {
    status: 'error',
    code: 'MERCHANT_APPLICATION_PENDING',
    applicationStatus: 'PENDING',
    data: { token: 'merchant-status-token' },
    message: 'ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ',
  });
});

test('wrong password and missing email return the same unauthorized response', async () => {
  const existingProvider: CredentialProvider = async () => candidate('correct-password', authenticated('merchant-1', 'MERCHANT'));
  const missingProvider: CredentialProvider = async () => null;
  const wrongPasswordHashes: string[] = [];
  const missingEmailHashes: string[] = [];
  const trackHashes = (target: string[]) => async (password: string, hash: string): Promise<boolean> => {
    target.push(hash);
    return verifyByExactMatch(password, hash);
  };
  const wrongPasswordLogin = createCredentialLoginService([existingProvider, missingProvider], trackHashes(wrongPasswordHashes), dummyHash);
  const missingEmailLogin = createCredentialLoginService([missingProvider, missingProvider], trackHashes(missingEmailHashes), dummyHash);

  assert.deepEqual(await invokeLogin(wrongPasswordLogin, 'wrong-password'), {
    statusCode: 401,
    body: { message: INVALID_CREDENTIALS_MESSAGE },
  });
  assert.deepEqual(await invokeLogin(missingEmailLogin, 'wrong-password'), {
    statusCode: 401,
    body: { message: INVALID_CREDENTIALS_MESSAGE },
  });
  assert.deepEqual(wrongPasswordHashes.sort(), ['correct-password', 'dummy-password-hash']);
  assert.deepEqual(missingEmailHashes, ['dummy-password-hash', 'dummy-password-hash']);
});

test('matching passwords in both account sources return the account collision error', async () => {
  const merchantProvider: CredentialProvider = async () => candidate('shared-password', authenticated('merchant-1', 'MERCHANT'));
  const staffProvider: CredentialProvider = async () => candidate('shared-password', authenticated('admin-1', 'ADMIN'));
  const login = createCredentialLoginService([merchantProvider, staffProvider], verifyByExactMatch, dummyHash);

  assert.deepEqual(await invokeLogin(login, 'shared-password'), {
    statusCode: 409,
    body: { message: ACCOUNT_COLLISION_MESSAGE },
  });
});

const listen = async (app: express.Express): Promise<Server> => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const requestStatus = async (server: Server, path: string): Promise<number> => {
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST' });
  return response.status;
};

test('unified credential login rate limit allows five attempts and blocks the sixth', async (context) => {
  const app = express();
  app.post('/auth/login', authLoginRateLimit, (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) statuses.push(await requestStatus(server, '/auth/login'));
  assert.deepEqual(statuses, [204, 204, 204, 204, 204, 429]);
});

test('demo login guard rejects non-development and passes development requests', async (context) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const app = express();
  app.post('/auth/demo-login', developmentOnlyDemoLogin, (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  context.after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  process.env.NODE_ENV = 'production';
  assert.equal(await requestStatus(server, '/auth/demo-login'), 404);
  process.env.NODE_ENV = 'development';
  assert.equal(await requestStatus(server, '/auth/demo-login'), 204);
});
