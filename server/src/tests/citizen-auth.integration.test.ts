import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import bcrypt from 'bcryptjs';

const keepOpen = process.argv.includes('--keep-open');
const sourceUrl = process.env.PAYMENT_TEST_DATABASE_URL || process.env.DIRECT_URL;
if (!sourceUrl) throw new Error('Set PAYMENT_TEST_DATABASE_URL or DIRECT_URL to run isolated Citizen API checks.');

const schema = `dev2_citizen_e2e_${randomUUID().replace(/-/g, '')}`;
if (!/^dev2_citizen_e2e_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid isolated schema name');

const campaignId = randomUUID();
const firstCitizenId = randomUUID();
const secondCitizenId = randomUUID();
const merchantId = randomUUID();
const unapprovedMerchantId = randomUUID();
const adminStaffId = randomUUID();
const unlinkedAdminStaffId = randomUUID();

const bangkokMonthStart = (year: number, month: number): Date => new Date(Date.UTC(year, month, 1, -7));

const fetchJson = async (baseUrl: string, path: string, token?: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  return { response, body: await response.json().catch(() => null) };
};

const main = async () => {
  process.env.NODE_ENV = 'development';
  process.env.PORT = '5001';
  process.env.CLIENT_URL = 'http://localhost:5174';
  process.env.DATABASE_URL = sourceUrl;
  process.env.DIRECT_URL = sourceUrl;
  process.env.REDIS_URL = '';
  process.env.UPSTASH_REDIS_REST_URL = '';
  process.env.UPSTASH_REDIS_REST_TOKEN = '';

  const admin = new PrismaClient({ datasourceUrl: sourceUrl, log: [] });
  const targetUrl = new URL(sourceUrl);
  targetUrl.searchParams.set('schema', schema);
  targetUrl.searchParams.set('connection_limit', '6');
  const db = new PrismaClient({ datasourceUrl: targetUrl.toString(), log: [] });
  let schemaCreated = false;
  let server: Server | undefined;

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;

    const tables = [
      'users', 'merchants', 'merchant_applications', 'staff_accounts', 'auth_identities', 'campaigns', 'campaign_periods',
      'wallets', 'wallet_period_quotas', 'transactions', 'wallet_transactions', 'fraud_checks', 'referrals',
      'rewards', 'user_rewards', 'reviews', 'badges', 'condition_types', 'badge_tiers', 'user_badges',
      'user_badge_history', 'quests', 'user_quests', 'payment_pins', 'payment_qr_codes',
    ];
    for (const table of tables) {
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }

    const schemaCheck = await db.$queryRawUnsafe<Array<{ schema: string }>>('SELECT current_schema() AS schema');
    assert.equal(schemaCheck[0].schema, schema, 'API fixtures must use only the isolated schema');
    (globalThis as typeof globalThis & { prisma?: PrismaClient }).prisma = db;

    const currentBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = currentBangkok.getUTCFullYear();
    const month = currentBangkok.getUTCMonth();
    const campaignStart = bangkokMonthStart(year, month);
    const campaignEnd = bangkokMonthStart(year, month + 3);
    const campaign = await db.campaigns.create({
      data: {
        campaign_id: campaignId,
        campaign_name: 'Isolated Citizen E2E Campaign',
        total_quota_limit: 3000,
        daily_quota_limit: 150,
        start_date: campaignStart,
        end_date: campaignEnd,
        status: 'ACTIVE',
      },
    });

    const periods = await Promise.all([0, 1, 2].map((offset) => db.campaign_periods.create({
      data: {
        campaign_id: campaign.campaign_id,
        period_name: `Test month ${offset + 1}`,
        period_quota_limit: 1000,
        start_date: bangkokMonthStart(year, month + offset),
        end_date: bangkokMonthStart(year, month + offset + 1),
      },
    })));

    const users = await Promise.all([firstCitizenId, secondCitizenId].map((userId, index) =>
      db.user.create({
        data: {
          user_id: userId,
          citizen_id_hash: `synthetic-citizen-e2e-${randomUUID()}`,
          full_name: `Synthetic Citizen ${index + 1}`,
          province_code: '10',
          is_registered_thai_plus: true,
          created_at: new Date(`2026-10-0${index + 1}T00:00:00.000Z`),
        },
      })
    ));

    await db.merchants.create({
      data: {
        merchant_id: merchantId,
        tax_id: `test-${randomUUID().replace(/-/g, '').slice(0, 15)}`,
        shop_name: 'Synthetic Merchant',
        latitude: 13.7563,
        longitude: 100.5018,
        is_approved: true,
      },
    });
    await db.merchants.create({
      data: {
        merchant_id: unapprovedMerchantId,
        tax_id: `test-${randomUUID().replace(/-/g, '').slice(0, 15)}`,
        shop_name: 'Synthetic Unapproved Merchant',
        latitude: 13.7563,
        longitude: 100.5018,
        is_approved: false,
      },
    });
    await db.staff_accounts.create({
      data: {
        staff_id: adminStaffId,
        email: `synthetic-${randomUUID()}@example.test`,
        full_name: 'Synthetic Admin',
        password_hash: 'not-used-by-demo-login',
        role: 'ADMIN',
        is_active: true,
      },
    });
    await db.staff_accounts.create({
      data: {
        staff_id: unlinkedAdminStaffId,
        email: `synthetic-unlinked-${randomUUID()}@example.test`,
        full_name: 'Synthetic Unlinked Admin',
        password_hash: 'not-used-by-demo-login',
        role: 'ADMIN',
        is_active: true,
      },
    });
    await db.auth_identities.create({
      data: {
        email: `synthetic-admin-${randomUUID()}@example.test`,
        account_type: 'STAFF_ACCOUNT',
        account_id: adminStaffId,
      },
    });

    const syntheticPin = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await db.payment_pins.create({
      data: {
        user_id: firstCitizenId,
        pin_hash: await bcrypt.hash(syntheticPin, 10),
        failed_attempts: 0,
      },
    });

    const wallets = await Promise.all(users.map((user, index) => db.wallets.create({
      data: {
        user_id: user.user_id,
        campaign_id: campaign.campaign_id,
        balance: index === 0 ? 2000 : 777,
        daily_quota_limit: 150,
        daily_quota_used: 0,
        total_quota_remaining: 3000,
        eligibility_status: 'ELIGIBLE',
        status: 'ACTIVE',
        last_quota_reset_date: new Date(),
      },
    })));

    await db.wallet_period_quotas.createMany({
      data: wallets.flatMap((wallet) => periods.map((period) => ({
        wallet_id: wallet.wallet_id,
        period_id: period.period_id,
        quota_limit: 1000,
        quota_used: 0,
        quota_remaining: 1000,
      }))),
    });

    const { default: app } = await import('../app');
    const { signToken } = await import('../utils/jwt');
    const port = keepOpen ? 5001 : 0;
    server = await new Promise<Server>((resolve, reject) => {
      const listener = (app as Express).listen(port, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    const health = await fetchJson(baseUrl, '/health');
    assert.equal(health.response.status, 200);

    const login = await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'CITIZEN' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.data.user.id, firstCitizenId);
    assert.equal(login.body.data.user.role, 'USER');
    assert.equal('citizen_id_hash' in login.body.data.user, false);
    const citizenToken = login.body.data.token as string;

    const merchantLogin = await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'MERCHANT' }),
    });
    assert.equal(merchantLogin.response.status, 200);
    assert.equal(merchantLogin.body.data.user.id, merchantId);
    assert.equal(merchantLogin.body.data.user.role, 'MERCHANT');
    const merchantToken = merchantLogin.body.data.token as string;

    const adminLogin = await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'ADMIN' }),
    });
    assert.equal(adminLogin.response.status, 200);
    assert.equal(adminLogin.body.data.user.id, adminStaffId);
    assert.equal(adminLogin.body.data.user.role, 'ADMIN');
    const adminToken = adminLogin.body.data.token as string;

    assert.equal((await fetchJson(baseUrl, '/auth/login', undefined, { method: 'POST', body: '{}' })).response.status, 404);
    assert.equal((await fetchJson(baseUrl, '/auth/register', undefined, { method: 'POST', body: '{}' })).response.status, 404);
    assert.equal((await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'CITIZEN', accountId: secondCitizenId }),
    })).response.status, 200);
    assert.equal((await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'CITIZEN', accountId: randomUUID() }),
    })).response.status, 404);
    assert.equal((await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'MERCHANT', accountId: unapprovedMerchantId }),
    })).response.status, 404);
    assert.equal((await fetchJson(baseUrl, '/auth/demo-login', undefined, {
      method: 'POST', body: JSON.stringify({ role: 'ADMIN', accountId: unlinkedAdminStaffId }),
    })).response.status, 404);
    assert.equal((await fetchJson(baseUrl, '/auth/me')).response.status, 401);
    assert.equal((await fetchJson(baseUrl, '/auth/me', 'invalid-token')).response.status, 401);
    assert.equal((await fetchJson(baseUrl, '/wallet/balance')).response.status, 401);
    const pinStatus = await fetchJson(baseUrl, '/wallet/pin/status', citizenToken);
    assert.equal(pinStatus.response.status, 200);
    assert.equal(pinStatus.body.data.isSet, true);

    const profile = await fetchJson(baseUrl, '/auth/me?userId=another-citizen', citizenToken);
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.data.user_id, firstCitizenId);
    assert.equal('citizen_id_hash' in profile.body.data, false);

    const wallet = await fetchJson(baseUrl, '/wallet/balance?userId=another-citizen', citizenToken);
    assert.equal(wallet.response.status, 200);
    assert.equal(wallet.body.data.walletId, wallets[0].wallet_id);
    assert.equal(wallet.body.data.balance, 2000);
    assert.equal(wallet.body.data.totalQuotaRemaining, 3000);
    assert.equal(wallet.body.data.periodQuota.currentPeriod.quotaRemaining, 1000);
    assert.equal(wallet.body.data.periodQuota.currentPeriod.quotaUsed, 0);

    const achievements = await fetchJson(baseUrl, '/me/badges?userId=another-citizen', citizenToken);
    assert.equal(achievements.response.status, 200);
    assert.deepEqual(achievements.body.data, []);
    assert.equal((await fetchJson(baseUrl, '/me/badges')).response.status, 401);

    const conditionType = await db.condition_types.create({
      data: {
        condition_key: 'transaction_count',
        display_name: 'จำนวนรายการที่สำเร็จ',
        measurement_unit: 'count',
        implementation_status: 'ready',
      },
    });
    const badge = await db.badges.create({
      data: {
        badge_name: 'Synthetic private award',
        description: 'Isolated authentication fixture',
        condition_type: conditionType.condition_key,
        status: 'active',
        implementation_status: 'ready',
        badge_tiers: { create: [{ tier_name: 'Bronze', tier_level: 1, required_count: 1 }] },
      },
      include: { badge_tiers: true },
    });
    const awardedTier = badge.badge_tiers[0];
    assert.ok(awardedTier);
    await db.user_badges.create({
      data: {
        user_id: secondCitizenId,
        badge_id: badge.badge_id,
        badge_tier_id: awardedTier.tier_id,
      },
    });

    const anotherCitizenToken = signToken({ userId: secondCitizenId, role: 'CITIZEN' });
    const spoofedAchievements = await fetchJson(baseUrl, `/me/badges?userId=${secondCitizenId}`, citizenToken);
    assert.equal(spoofedAchievements.response.status, 200);
    assert.equal(spoofedAchievements.body.data.length, 1);
    assert.equal(spoofedAchievements.body.data[0].isUnlocked, false);
    assert.equal(spoofedAchievements.body.data[0].tiers[0].unlocked, false);

    const spoofedBadge = await fetchJson(baseUrl, `/me/badges/${badge.badge_id}?userId=${secondCitizenId}`, citizenToken);
    assert.equal(spoofedBadge.response.status, 200);
    assert.equal(spoofedBadge.body.data.isUnlocked, false);
    assert.equal(spoofedBadge.body.data.currentTier, null);

    const ownerBadge = await fetchJson(baseUrl, `/me/badges/${badge.badge_id}`, anotherCitizenToken);
    assert.equal(ownerBadge.response.status, 200);
    assert.equal(ownerBadge.body.data.isUnlocked, true);
    assert.equal(ownerBadge.body.data.currentTier.id, awardedTier.tier_id);

    const merchantJwt = signToken({ userId: randomUUID(), role: 'MERCHANT' });
    assert.equal((await fetchJson(baseUrl, '/campaigns', citizenToken)).response.status, 403);
    assert.equal((await fetchJson(baseUrl, '/auth/me', adminToken)).response.status, 403);
    assert.equal((await fetchJson(baseUrl, '/wallet/balance', adminToken)).response.status, 403);
    assert.equal((await fetchJson(baseUrl, '/wallet/balance', merchantJwt)).response.status, 403);

    assert.equal((await fetchJson(baseUrl, '/campaigns', merchantToken)).response.status, 403);
    const adminCampaigns = await fetchJson(baseUrl, '/campaigns', adminToken);
    assert.equal(adminCampaigns.response.status, 200);
    assert.equal(adminCampaigns.body.data[0].id, campaign.campaign_id);
    assert.equal(adminCampaigns.body.data[0].totalQuotaLimit, '3000');
    assert.equal(adminCampaigns.body.data[0].periods.length, 3);
    assert.ok(adminCampaigns.body.data[0].periods.every((period: { quotaLimit: string }) => period.quotaLimit === '1000'));
    assert.equal((await fetchJson(baseUrl, '/condition-types', adminToken)).response.status, 200);
    assert.equal((await fetchJson(baseUrl, '/badge-condition-types', adminToken)).response.status, 200);
    assert.equal((await fetchJson(baseUrl, '/badges', adminToken)).response.status, 200);

    console.log('Authentication integration passed: Citizen, Merchant, and Admin demo JWTs, role guards, profile, wallet, achievements, and Admin APIs.');
    if (keepOpen) {
      console.log(`Isolated browser API ready at http://localhost:${address.port}; synthetic Citizen: ${firstCitizenId}.`);
      await new Promise<void>((resolve) => process.once('SIGINT', resolve));
    }
  } finally {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    }
    await db.$disconnect();
    if (schemaCreated) {
      try {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } catch {
        throw new Error('Could not remove the temporary Citizen E2E schema; its generated name is isolated and may need cleanup.');
      }
    }
    await admin.$disconnect();
    delete (globalThis as typeof globalThis & { prisma?: PrismaClient }).prisma;
  }
};

void main().catch((error) => {
  console.error('Citizen API integration failed.', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
