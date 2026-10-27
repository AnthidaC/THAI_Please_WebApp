import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import type { Server } from 'node:http';

/** Creates EMPTY clones in a random schema. Never reads or modifies public user/payment rows. */
async function main() {
  process.env.NODE_ENV = 'test';
  process.env.AI_FRAUD_API_KEY = '';
  process.env.AI_FRAUD_ENDPOINT = '';
  const sourceUrl = process.env.PAYMENT_TEST_DATABASE_URL || process.env.DIRECT_URL;
  if (!sourceUrl) throw new Error('Set PAYMENT_TEST_DATABASE_URL or DIRECT_URL to run isolated integration tests.');
  const schema = `dev2_payment_test_${randomUUID().replace(/-/g, '')}`;
  if (!/^dev2_payment_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid isolated schema name');
  const admin = new PrismaClient({ datasourceUrl: sourceUrl, log: [] });
  const testUrl = new URL(sourceUrl);
  testUrl.searchParams.set('schema', schema);
  testUrl.searchParams.set('connection_limit', '6');
  const db = new PrismaClient({ datasourceUrl: testUrl.toString(), log: [] });
  let server: Server | undefined;
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    const tables = ['users', 'merchants', 'merchant_applications', 'staff_accounts', 'campaigns', 'campaign_periods',
      'wallets', 'wallet_period_quotas', 'transactions', 'wallet_transactions', 'fraud_checks', 'referrals',
      'rewards', 'user_rewards', 'reviews'];
    for (const table of tables) {
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    const current = await db.$queryRawUnsafe<Array<{ schema: string }>>('SELECT current_schema() AS schema');
    assert.equal(current[0].schema, schema, 'All raw queries must resolve to the isolated test schema');
    const sql = readFileSync(path.join(__dirname, '../../prisma/migrations/202610270001_payment_pin_and_qr/migration.sql'), 'utf8');
    const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(part => part.trim()).filter(Boolean);
    await db.$transaction(async tx => {
      for (const statement of statements) {
        if (statement === 'BEGIN' || statement === 'COMMIT') continue;
        await tx.$executeRawUnsafe(statement);
      }
    });
    (globalThis as any).prisma = db;
    const { paymentPinService } = await import('../services/payment-pin.service');
    const { paymentService, PaymentService } = await import('../services/payment.service');
    const { walletService } = await import('../services/wallet.service');
    const { fraudService } = await import('../services/fraud.service');
    const { transactionService } = await import('../services/transaction.service');
    const { qrStore } = await import('../services/payment-qr.store');
    const { thaiDateKey } = await import('../utils/thai-date');
    const { signToken } = await import('../utils/jwt');
    const walletRoutes = (await import('../routes/wallet.routes')).default;
    const paymentRoutes = (await import('../routes/payment.routes')).default;
    const transactionRoutes = (await import('../routes/transaction.routes')).default;
    const user = await db.user.create({ data: { citizen_id_hash: randomUUID(), full_name: 'PIN Test', province_code: '10' } });
    const otherUser = await db.user.create({ data: { citizen_id_hash: randomUUID(), full_name: 'Other Test', province_code: '10' } });
    const merchant = await db.merchants.create({ data: {
      tax_id: randomUUID().slice(0, 20), shop_name: 'Isolated Test Shop', latitude: 13.75, longitude: 100.5, is_approved: true,
    } });
    const application = await db.merchantApplication.create({ data: {
      business_type: 'INDIVIDUAL', tax_id: merchant.tax_id, shop_name: merchant.shop_name,
      contact_name: 'Test', email: 'test@example.invalid', phone: '0000000000', password_hash: 'not-a-real-login',
      address: 'Isolated fixture', latitude: merchant.latitude, longitude: merchant.longitude,
      status: 'APPROVED', merchant_id: merchant.merchant_id,
    } });
    const campaign = await db.campaigns.create({ data: {
      campaign_name: 'Isolated Test', start_date: new Date(Date.now() - 86400000), end_date: new Date(Date.now() + 86400000),
      daily_quota_limit: 200, total_quota_limit: 3000,
    } });
    const wallet = await db.wallets.create({ data: {
      user_id: user.user_id, campaign_id: campaign.campaign_id, balance: 1000, daily_quota_limit: 200,
      eligibility_status: 'ELIGIBLE', last_quota_reset_date: new Date(`${thaiDateKey()}T00:00:00Z`),
    } });
    const app = express(); app.use(express.json());
    app.use('/api/wallet', walletRoutes); app.use('/api/payment', paymentRoutes); app.use('/api/transactions', transactionRoutes);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const port = (server.address() as { port: number }).port;
    const token = signToken({ userId: user.user_id, role: 'CITIZEN' });
    const merchantToken = signToken({ userId: application.application_id, role: 'MERCHANT' });
    const request = (route: string, bearer?: string, body?: unknown, method = body ? 'POST' : 'GET') => fetch(`http://127.0.0.1:${port}/api${route}`, {
      method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const checkCode = (code: string) => (error: any) => error.code === code;
    assert.equal((await request('/wallet/pin/status')).status, 401);
    assert.equal((await request('/wallet/pin/status', 'demo-token')).status, 401);
    assert.equal((await paymentPinService.getStatus(user.user_id)).isSet, false);
    await assert.rejects(paymentPinService.verify(user.user_id, '123456'), checkCode('PIN_NOT_SET'));
    assert.equal((await request('/wallet/pin', token, { pin: '123456', confirmPin: '654321' }, 'PUT')).status, 400);
    assert.equal((await request('/wallet/pin', token, { pin: '123456', confirmPin: '123456' }, 'PUT')).status, 200);
    assert.notEqual((await db.payment_pins.findUniqueOrThrow({ where: { user_id: user.user_id } })).pin_hash, '123456');
    await assert.rejects(paymentPinService.setPin(user.user_id, '234567'), checkCode('CURRENT_PIN_REQUIRED'));
    for (let i = 1; i <= 5; i++) {
      await assert.rejects(paymentPinService.verify(user.user_id, '000000'), checkCode(i === 5 ? 'PIN_LOCKED' : 'PIN_INCORRECT'));
    }
    await assert.rejects(paymentPinService.verify(user.user_id, '123456'), checkCode('PIN_LOCKED'));
    assert.equal((await db.payment_pins.findUniqueOrThrow({ where: { user_id: user.user_id } })).failed_attempts, 5);
    await db.payment_pins.update({ where: { user_id: user.user_id }, data: { locked_until: new Date(Date.now() - 1000) } });
    await paymentPinService.verify(user.user_id, '123456');
    await paymentPinService.setPin(user.user_id, '234567', '123456');
    await assert.rejects(paymentPinService.verify(user.user_id, '123456'), checkCode('PIN_INCORRECT'));
    await paymentPinService.verify(user.user_id, '234567');
    const setupRace = await Promise.allSettled([
      paymentPinService.setPin(otherUser.user_id, '123456'), paymentPinService.setPin(otherUser.user_id, '654321'),
    ]);
    assert.equal(setupRace.filter(result => result.status === 'fulfilled').length, 1);
    console.log('PASS: setup/change PIN, salted hash, attempt persistence, lockout, expiry and authenticated API');

    const newQr = () => paymentService.generateDynamicQr({ merchantId: merchant.merchant_id, amount: 100, latitude: 13.75, longitude: 100.5 });
    const qr = await newQr();
    assert.equal((await new PaymentService().getQrDetails(qr.qrReference)).qrData.qrReference, qr.qrReference);
    await assert.rejects(paymentService.getQrPaymentStatus(qr.qrReference, randomUUID()), /ไม่พบ QR/);
    assert.equal((await request('/payment/qr/generate', token, { amount: 100, latitude: 13.75, longitude: 100.5 })).status, 403);
    const generated = await request('/payment/qr/generate', merchantToken, { amount: 100, latitude: 13.75, longitude: 100.5, merchantId: randomUUID() });
    assert.equal(generated.status, 201);
    assert.equal((await generated.json() as any).data.merchantId, merchant.merchant_id);

    const checkout = (reference: string, pin = '234567') => paymentService.checkout({
      userId: user.user_id, qrReference: reference, userLatitude: 13.75, userLongitude: 100.5, pin,
    });
    const originalFraud = fraudService.evaluateTransaction.bind(fraudService);
    const safeAssessment = { distanceMeters: 0, riskScore: 0.01, decision: 'AUTO_APPROVED' as const, reason: 'Isolated test', confidence: 1, model: 'test' };
    fraudService.evaluateTransaction = async () => safeAssessment;
    await assert.rejects(checkout(qr.qrReference, '000000'), checkCode('PIN_INCORRECT'));
    assert.equal(Number((await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } })).balance), 1000);
    const paid = await checkout(qr.qrReference);
    assert.equal(paid.citizenPaidAmount, 40); assert.equal(paid.governmentCopayAmount, 60);
    assert.equal((await qrStore.get(qr.qrReference))!.paidTransaction!.transactionId, paid.transactionId);
    await assert.rejects(checkout(qr.qrReference), /ถูกใช้งาน/);
    assert.equal(await db.transactions.count({ where: { qr_reference: qr.qrReference, status: { in: ['SUCCESS', 'FLAGGED'] } } }), 1);
    await qrStore.set(qr.qrReference, { ...qr, status: 'EXPIRED' });
    assert.equal((await qrStore.get(qr.qrReference))!.status, 'USED');
    await assert.rejects(transactionService.getTransactionSlip(paid.transactionId, otherUser.user_id), /ไม่พบ/);
    assert.equal((await request(`/transactions/${paid.transactionId}/slip`)).status, 401);
    console.log('PASS: durable QR, merchant ownership, wrong PIN cannot debit, single-use QR and slip ownership');

    const raceQr = await newQr();
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    fraudService.evaluateTransaction = async () => {
      if (++arrivals === 2) release();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([barrier, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Checkout barrier timed out')), 15000); })]);
      } finally { if (timer) clearTimeout(timer); }
      return safeAssessment;
    };
    const results = await Promise.allSettled([checkout(raceQr.qrReference), checkout(raceQr.qrReference)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await db.transactions.count({ where: { qr_reference: raceQr.qrReference } }), 1);
    assert.equal(Number((await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } })).balance), 920);
    fraudService.evaluateTransaction = async () => safeAssessment;
    const rollbackQr = await newQr();
    await db.$executeRawUnsafe('ALTER TABLE wallet_transactions ADD CONSTRAINT test_reject_debit CHECK (transaction_type <> \'COPAY_PAYMENT\') NOT VALID');
    await assert.rejects(checkout(rollbackQr.qrReference));
    assert.equal((await qrStore.get(rollbackQr.qrReference))!.status, 'ACTIVE');
    assert.equal(Number((await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } })).balance), 920);
    await db.$executeRawUnsafe('ALTER TABLE wallet_transactions DROP CONSTRAINT test_reject_debit');
    const topups = await Promise.all([walletService.topUp(user.user_id, 10), walletService.topUp(user.user_id, 20)]);
    assert.equal(topups.length, 2);
    assert.equal(Number((await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } })).balance), 950);
    const [firstQr, secondQr] = await Promise.all([newQr(), newQr()]);
    arrivals = 0;
    let releaseSecond!: () => void;
    const secondBarrier = new Promise<void>(resolve => { releaseSecond = resolve; });
    fraudService.evaluateTransaction = async () => {
      if (++arrivals === 2) releaseSecond();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([secondBarrier, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet barrier timed out')), 15000); })]); }
      finally { if (timer) clearTimeout(timer); }
      return safeAssessment;
    };
    const walletRace = await Promise.allSettled([checkout(firstQr.qrReference), checkout(secondQr.qrReference)]);
    assert.equal(walletRace.filter(result => result.status === 'fulfilled').length, 1);
    const afterRace = await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } });
    assert.equal(Number(afterRace.balance), 910);
    assert.equal(Number(afterRace.daily_quota_used), 180);
    const expired = await newQr();
    await paymentService._simulateExpireQr(expired.qrReference);
    await assert.rejects(paymentService.getQrDetails(expired.qrReference), /หมดอายุ/);
    fraudService.evaluateTransaction = originalFraud;
    console.log('PASS: simultaneous checkout, transaction rollback releases QR, concurrent top-ups preserve balances');

    await db.transactions.createMany({ data: [
      { user_id: user.user_id, merchant_id: merchant.merchant_id, total_amount: 10, citizen_paid_amount: 4, government_copay_amount: 6, status: 'SUCCESS', created_at: new Date('2001-01-01T16:59:59Z') },
      { user_id: user.user_id, merchant_id: merchant.merchant_id, total_amount: 20, citizen_paid_amount: 8, government_copay_amount: 12, status: 'SUCCESS', created_at: new Date('2001-01-01T17:00:00Z') },
    ] });
    const daily = await transactionService.getMerchantHistory(merchant.merchant_id, '2001-01-02');
    assert.equal(daily.summary.totalRevenue, 20);
    await assert.rejects(transactionService.getMerchantHistory(merchant.merchant_id, '2026-02-30'), /วันที่/);
    const enrolled = await walletService.enrollInCampaign(user.user_id, campaign.campaign_id);
    assert.equal(enrolled.wallet.totalQuotaRemaining, Number(afterRace.total_quota_remaining));
    await db.campaign_periods.create({ data: {
      campaign_id: campaign.campaign_id, period_name: 'Test period', period_quota_limit: 1000,
      start_date: new Date(Date.now() - 86400000), end_date: new Date(Date.now() + 86400000),
    } });
    await db.wallets.update({ where: { wallet_id: wallet.wallet_id }, data: { total_quota_remaining: 5 } });
    const cappedQr = await newQr();
    const preview = await paymentService.getQrDetails(cappedQr.qrReference, user.user_id);
    assert.equal(preview.copaySplit!.governmentCopayAmount, 5);
    fraudService.evaluateTransaction = async () => safeAssessment;
    const cappedPayment = await checkout(cappedQr.qrReference);
    assert.equal(cappedPayment.governmentCopayAmount, 5); assert.equal(cappedPayment.citizenPaidAmount, 95);
    assert.equal(Number((await db.wallets.findUniqueOrThrow({ where: { wallet_id: wallet.wallet_id } })).total_quota_remaining), 0);
    fraudService.evaluateTransaction = originalFraud;
    const rejected = await db.transactions.create({ data: {
      user_id: user.user_id, merchant_id: merchant.merchant_id, total_amount: 100, citizen_paid_amount: 0,
      government_copay_amount: 0, status: 'REJECTED',
    } });
    const rejectedCheck = await db.fraud_checks.create({ data: {
      transaction_id: rejected.transaction_id, user_latitude: 13.8, user_longitude: 100.5,
      merchant_latitude: 13.75, merchant_longitude: 100.5, distance_meters: 5500, is_distance_valid: false, decision: 'REJECTED',
    } });
    await fraudService.resolveAlert(rejectedCheck.fraud_check_id, 'APPROVE');
    const reviewed = await db.transactions.findUniqueOrThrow({ where: { transaction_id: rejected.transaction_id } });
    assert.equal(reviewed.status, 'REJECTED'); assert.equal(reviewed.completed_at, null);
    const yesterday = new Date(`${thaiDateKey()}T00:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await db.wallets.update({ where: { wallet_id: wallet.wallet_id }, data: { last_quota_reset_date: yesterday, daily_quota_used: 180 } });
    const reset = await walletService.getWalletByUserId(user.user_id);
    assert.equal(reset.dailyQuotaUsed, 0); assert.equal(reset.lastQuotaResetDate.slice(0, 10), thaiDateKey());
    console.log('PASS: daily sales use Thai midnight and validate calendar dates');
    console.log('All isolated payment integration checks passed.');
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await db.$disconnect();
    if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
