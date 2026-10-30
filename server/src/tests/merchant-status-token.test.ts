import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { authenticate, requireAdmin, requireApprovedMerchant, requireCitizen, requireStaff, restrictScopedTokens } from '../middlewares/auth.middleware';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { authenticatePaymentSession, requirePaymentMerchant } from '../middlewares/payment-access.middleware';
import { optionalAuthenticate } from '../routes/recommendation.routes';
import { env } from '../config/env';
import { signMerchantApplicationStatusToken, signToken } from '../utils/jwt';

const listen = async (app: express.Express): Promise<Server> => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('merchant application status token is denied across merchant, staff, admin, citizen and public-review endpoints', async (context) => {
  const app = express();
  app.use(restrictScopedTokens);
  app.get('/api/merchant-applications/me/status', authenticate, (_req, res) => res.sendStatus(204));
  app.post('/api/merchant-applications/me/status', authenticate, (_req, res) => res.sendStatus(204));
  app.get('/api/merchant-applications/profile', authenticate, requireApprovedMerchant, (_req, res) => res.sendStatus(204));
  app.get('/api/staff/merchants', authenticate, requireStaff, (_req, res) => res.sendStatus(204));
  app.get('/api/admin/summary', authenticate, requireAdmin, (_req, res) => res.sendStatus(204));
  app.get('/api/auth/me', authenticate, requireCitizen, (_req, res) => res.sendStatus(204));
  app.get('/api/admin/campaigns', authenticateAdmin, (_req, res) => res.sendStatus(204));
  app.get('/api/wallet/balance', authenticatePaymentSession, requirePaymentMerchant, (_req, res) => res.sendStatus(204));
  app.get('/api/recommendations/near-me', optionalAuthenticate, (_req, res) => res.sendStatus(204));
  app.get('/api/reviews/merchant/:merchantId', (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const token = signMerchantApplicationStatusToken('4d2ae5bd-a485-4aca-81ed-3c856f469b2f');
  const address = server.address() as AddressInfo;
  const request = (path: string, method = 'GET') => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal((await request('/api/merchant-applications/me/status')).status, 204);
  for (const path of [
    '/api/merchant-applications/profile',
    '/api/staff/merchants',
    '/api/admin/summary',
    '/api/auth/me',
    '/api/admin/campaigns',
    '/api/wallet/balance',
    '/api/recommendations/near-me',
    '/api/reviews/merchant/merchant-id',
  ]) {
    assert.equal((await request(path)).status, 403, `status-only token must be denied at ${path}`);
  }
  assert.equal((await request('/api/merchant-applications/me/status', 'POST')).status, 403);
});

test('unknown scopes and a status role without the required scope fail closed', async (context) => {
  const app = express();
  app.use(restrictScopedTokens);
  app.get('/api/merchant-applications/me/status', authenticate, (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address() as AddressInfo;
  const tokens = [
    signToken({ userId: 'application-id', role: 'MERCHANT_APPLICATION_STATUS', tokenScope: 'FUTURE_SCOPE' }),
    signToken({ userId: 'application-id', role: 'MERCHANT_APPLICATION_STATUS' }),
  ];
  for (const token of tokens) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/merchant-applications/me/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  }
});

test('merchant status token expires within 15 minutes', () => {
  const token = signMerchantApplicationStatusToken('application-id');
  const payload = jwt.decode(token);
  assert.ok(payload && typeof payload !== 'string');
  assert.equal(typeof payload.exp, 'number');
  assert.equal(typeof payload.iat, 'number');
  assert.ok(payload.exp - payload.iat <= 15 * 60);
  assert.equal(jwt.verify(token, env.JWT_SECRET).toString() !== '', true);
});
