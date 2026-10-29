import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { authenticate } from '../middlewares/auth.middleware';
import { signToken } from '../utils/jwt';

const listen = async (app: express.Express): Promise<Server> => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('merchant application status token only authorizes the own-status GET endpoint', async (context) => {
  const app = express();
  app.get('/api/merchant-applications/me/status', authenticate, (_req, res) => res.sendStatus(204));
  app.post('/api/merchant-applications/me/status', authenticate, (_req, res) => res.sendStatus(204));
  app.get('/api/preferences', authenticate, (_req, res) => res.sendStatus(204));
  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const token = signToken({
    userId: '4d2ae5bd-a485-4aca-81ed-3c856f469b2f',
    role: 'MERCHANT_APPLICATION_STATUS',
    tokenScope: 'MERCHANT_APPLICATION_STATUS',
  });
  const address = server.address() as AddressInfo;
  const request = (path: string, method = 'GET') => fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal((await request('/api/merchant-applications/me/status')).status, 204);
  assert.equal((await request('/api/preferences')).status, 403);
  assert.equal((await request('/api/merchant-applications/me/status', 'POST')).status, 403);
});
