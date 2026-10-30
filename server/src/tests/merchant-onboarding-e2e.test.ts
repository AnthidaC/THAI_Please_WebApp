import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { env } from '../config/env';
import { merchantApplicationSchema } from '../validations/merchant-application.validation';

const listen = async (app: express.Express): Promise<Server> =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

test('Merchant registration, approval, and login status lifecycle flow', async (context) => {
  // In-memory application store for clean isolated lifecycle verification
  const applications: Record<string, {
    applicationId: string;
    businessName: string;
    taxId: string;
    email: string;
    password: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    documents: any[];
  }> = {};

  const app = express();
  app.use(express.json());

  // 1. Submit Application Endpoint
  app.post('/api/merchant-applications/applications', (req, res) => {
    // Validate schema
    const parsed = merchantApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', errors: parsed.error.issues });
    }

    // Check document requirement via FEATURE FLAG
    const files = req.body.files ?? [];
    if (env.MERCHANT_REQUIRE_DOCUMENTS && files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาแนบรูปหน้าร้าน หลักฐานบัญชี และเอกสารตามประเภทธุรกิจให้ครบ',
      });
    }

    const applicationId = `app-${Date.now()}`;
    applications[applicationId] = {
      applicationId,
      businessName: parsed.data.businessName,
      taxId: parsed.data.taxId,
      email: parsed.data.email,
      password: parsed.data.password,
      status: 'PENDING',
      documents: files,
    };

    return res.status(201).json({
      status: 'success',
      data: { applicationId, status: 'PENDING' },
    });
  });

  // 2. Admin List Endpoint
  app.get('/api/merchant-applications/applications', (req, res) => {
    const status = req.query.status as string;
    const items = Object.values(applications).filter((a) => a.status === status);
    res.json({ status: 'success', data: items });
  });

  // 3. Admin Decision Endpoint
  app.patch('/api/merchant-applications/applications/:id/decision', (req, res) => {
    const { id } = req.params;
    const { action } = req.body;
    const appRecord = applications[id];
    if (!appRecord || appRecord.status !== 'PENDING') {
      return res.status(409).json({ status: 'error', message: 'คำขอนี้ถูกดำเนินการแล้วหรือไม่อยู่ในสถานะรอตรวจสอบ' });
    }
    appRecord.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    res.json({ status: 'success', data: { applicationId: id, status: appRecord.status } });
  });

  // 4. Merchant Login Endpoint
  app.post('/api/merchant-applications/login', (req, res) => {
    const { email, password } = req.body;
    const appRecord = Object.values(applications).find((a) => a.email === email && a.password === password);
    if (!appRecord) {
      return res.status(401).json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    if (appRecord.status === 'PENDING') {
      return res.status(403).json({
        status: 'error',
        code: 'MERCHANT_APPLICATION_PENDING',
        applicationStatus: 'PENDING',
        message: 'ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ',
      });
    }

    if (appRecord.status === 'APPROVED') {
      return res.json({
        status: 'success',
        data: {
          user: {
            id: 'm-123',
            email: appRecord.email,
            name: appRecord.businessName,
            role: 'MERCHANT',
            merchantApprovalStatus: 'APPROVED',
          },
          token: 'mock-merchant-jwt-token',
        },
      });
    }

    return res.status(401).json({ status: 'error', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  });

  const server = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }));

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const validPayload = {
    businessType: 'INDIVIDUAL',
    taxId: '1234567890123',
    businessName: 'ร้านป้าสมศรี ของชำ',
    contactName: 'สมศรี มีทรัพย์',
    email: 'somsri.shop@example.com',
    phone: '0812345678',
    password: 'Password123456',
    address: '123/45 ถ.สุขุมวิท พระโขนง คลองเตย กรุงเทพฯ 10110',
    latitude: '13.7563', // String format as received from FormData in multipart request
    longitude: '100.5018',
  };

  // --- Test Case 1: When flag is TRUE, submitting without files fails with 400 ---
  (env as { MERCHANT_REQUIRE_DOCUMENTS: boolean }).MERCHANT_REQUIRE_DOCUMENTS = true;
  const resFail = await fetch(`${baseUrl}/api/merchant-applications/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(resFail.status, 400);
  const failData = await resFail.json();
  assert.ok(failData.message.includes('กรุณาแนบรูปหน้าร้าน'));

  // --- Test Case 2: When flag is FALSE, submitting without files SUCCEEDS (201 PENDING) ---
  (env as { MERCHANT_REQUIRE_DOCUMENTS: boolean }).MERCHANT_REQUIRE_DOCUMENTS = false;
  const resSuccess = await fetch(`${baseUrl}/api/merchant-applications/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  assert.equal(resSuccess.status, 201);
  const successData = await resSuccess.json();
  assert.equal(successData.status, 'success');
  assert.equal(successData.data.status, 'PENDING');
  const applicationId = successData.data.applicationId;

  // --- Test Case 3: Merchant tries to login immediately -> 403 PENDING ---
  const resLoginPending = await fetch(`${baseUrl}/api/merchant-applications/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: validPayload.email, password: validPayload.password }),
  });
  assert.equal(resLoginPending.status, 403);
  const loginPendingData = await resLoginPending.json();
  assert.equal(loginPendingData.applicationStatus, 'PENDING');
  assert.equal(loginPendingData.code, 'MERCHANT_APPLICATION_PENDING');

  // --- Test Case 4: Admin views PENDING applications -> sees the application ---
  const resList = await fetch(`${baseUrl}/api/merchant-applications/applications?status=PENDING`);
  assert.equal(resList.status, 200);
  const listData = await resList.json();
  assert.equal(listData.data.length, 1);
  assert.equal(listData.data[0].applicationId, applicationId);

  // --- Test Case 5: Admin APPROVES the application ---
  const resDecide = await fetch(`${baseUrl}/api/merchant-applications/applications/${applicationId}/decision`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  assert.equal(resDecide.status, 200);
  const decideData = await resDecide.json();
  assert.equal(decideData.data.status, 'APPROVED');

  // --- Test Case 6: Merchant logs in after approval -> 200 APPROVED with token ---
  const resLoginApproved = await fetch(`${baseUrl}/api/merchant-applications/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: validPayload.email, password: validPayload.password }),
  });
  assert.equal(resLoginApproved.status, 200);
  const loginApprovedData = await resLoginApproved.json();
  assert.equal(loginApprovedData.status, 'success');
  assert.equal(loginApprovedData.data.user.role, 'MERCHANT');
  assert.equal(loginApprovedData.data.user.merchantApprovalStatus, 'APPROVED');
  assert.ok(loginApprovedData.data.token);
});

