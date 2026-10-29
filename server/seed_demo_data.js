const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

const DEMO = {
  citizenId: '1101700203456',
  merchantEmail: 'noodle.shop@thaiplease.go.th',
  merchantPassword: 'DemoMerchant123!',
  staffEmail: 'admin.super@thaiplease.go.th',
  staffPassword: 'DemoAdmin123!',
};

async function main() {
  console.log('Seeding demo data...');

  // 1. Campaign (กำหนดวันเริ่มต้น-สิ้นสุด เพดาน 200 บ./วัน ยอดรวม 3,000 บ. เดือนละ 1,000 บ. ใน DB)
  const campaign = await prisma.campaigns.upsert({
    where: { campaign_id: '11111111-1111-1111-1111-111111111111' },
    update: {
      campaign_name: 'โครงการไทยช่วยไทยพลีส (THAI Please Co-pay 60/40)',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.000Z'),
      government_copay_rate_percent: 60.0,
      citizen_payment_rate_percent: 40.0,
      daily_quota_limit: 200.0,
      total_quota_limit: 3000.0,
      status: 'ACTIVE',
    },
    create: {
      campaign_id: '11111111-1111-1111-1111-111111111111',
      campaign_name: 'โครงการไทยช่วยไทยพลีส (THAI Please Co-pay 60/40)',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.000Z'),
      government_copay_rate_percent: 60.0,
      citizen_payment_rate_percent: 40.0,
      daily_quota_limit: 200.0,
      total_quota_limit: 3000.0,
      status: 'ACTIVE',
    },
  });
  console.log('Campaign ready:', campaign.campaign_name);

  // 2. Identities used by the real login endpoints (not fake client tokens)
  const staff = await prisma.staff_accounts.upsert({
    where: { email: DEMO.staffEmail },
    update: {
      full_name: 'System Administrator (Demo)',
      password_hash: await bcrypt.hash(DEMO.staffPassword, 10),
      role: 'ADMIN',
      is_active: true,
    },
    create: {
      email: DEMO.staffEmail,
      full_name: 'System Administrator (Demo)',
      password_hash: await bcrypt.hash(DEMO.staffPassword, 10),
      role: 'ADMIN',
      is_active: true,
    },
  });

  const merchant = await prisma.merchants.upsert({
    where: { tax_id: '0105566123456' },
    update: {
      shop_name: 'Noodle Shop Demo',
      latitude: 13.7563,
      longitude: 100.5018,
      is_approved: true,
      approved_by_admin_id: staff.staff_id,
    },
    create: {
      tax_id: '0105566123456',
      shop_name: 'Noodle Shop Demo',
      latitude: 13.7563,
      longitude: 100.5018,
      is_approved: true,
      approved_by_admin_id: staff.staff_id,
    },
  });

  await prisma.merchantApplication.upsert({
    where: { merchant_id: merchant.merchant_id },
    update: {
      email: DEMO.merchantEmail,
      password_hash: await bcrypt.hash(DEMO.merchantPassword, 10),
      status: 'APPROVED',
      reviewed_by_staff_id: staff.staff_id,
      reviewed_at: new Date(),
    },
    create: {
      business_type: 'INDIVIDUAL',
      tax_id: merchant.tax_id,
      shop_name: merchant.shop_name,
      contact_name: 'Demo Merchant',
      email: DEMO.merchantEmail,
      phone: '0812345678',
      password_hash: await bcrypt.hash(DEMO.merchantPassword, 10),
      address: 'Bangkok',
      latitude: 13.7563,
      longitude: 100.5018,
      status: 'APPROVED',
      merchant_id: merchant.merchant_id,
      reviewed_by_staff_id: staff.staff_id,
      reviewed_at: new Date(),
    },
  });

  const citizenIdHash = crypto.createHash('sha256').update(DEMO.citizenId).digest('hex');
  const user = await prisma.user.upsert({
    where: { citizen_id_hash: citizenIdHash },
    update: { full_name: 'Somchai Citizen Demo', province_code: '10', is_registered_thai_plus: true },
    create: {
      citizen_id_hash: citizenIdHash,
      full_name: 'Somchai Citizen Demo',
      province_code: '10',
      is_registered_thai_plus: true,
    },
  });
  if (user) {
    await prisma.wallets.updateMany({
      where: { user_id: user.user_id },
      data: {
        campaign_id: campaign.campaign_id,
        balance: 2000.0,
        daily_quota_limit: 200.0,
        total_quota_remaining: 3000.0,
        eligibility_status: 'ELIGIBLE',
      },
    });
  }

  // 4. Fraud check for existing tx d504c4c0-bb3a-482c-a810-6dbc2e50925d
  const txSusp = await prisma.transactions.findUnique({
    where: { transaction_id: 'd504c4c0-bb3a-482c-a810-6dbc2e50925d' },
  });

  if (txSusp) {
    await prisma.fraud_checks.upsert({
      where: { transaction_id: txSusp.transaction_id },
      update: {
        user_latitude: 13.795,
        user_longitude: 100.56,
        merchant_latitude: 13.75,
        merchant_longitude: 100.54,
        distance_meters: 5320.0,
        is_distance_valid: false,
        risk_score: 82.5,
        fraud_reason: 'GPS Distance: 5.32 km (Exceeds 2.0 km limit); Suspicious rapid repeat',
        decision: 'FLAGGED_FOR_REVIEW',
      },
      create: {
        transaction_id: txSusp.transaction_id,
        user_latitude: 13.795,
        user_longitude: 100.56,
        merchant_latitude: 13.75,
        merchant_longitude: 100.54,
        distance_meters: 5320.0,
        is_distance_valid: false,
        risk_score: 82.5,
        fraud_reason: 'GPS Distance: 5.32 km (Exceeds 2.0 km limit); Suspicious rapid repeat',
        decision: 'FLAGGED_FOR_REVIEW',
      },
    });
    console.log('Fraud check 1 seeded.');
  }

  // 5. Add another Flagged Tx for repeat count demonstration
  const tx2 = await prisma.transactions.upsert({
    where: { transaction_id: 'e615d5d1-cc4b-493d-b921-7ecd3f61036e' },
    update: {},
    create: {
      transaction_id: 'e615d5d1-cc4b-493d-b921-7ecd3f61036e',
      qr_reference: 'TP-QR-REPEAT-003',
      user_id: user.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: 300,
      government_copay_amount: 150,
      citizen_paid_amount: 150,
      status: 'SUCCESS',
      created_at: new Date(Date.now() - 1000 * 60 * 30),
      completed_at: new Date(Date.now() - 1000 * 60 * 29),
    },
  });

  await prisma.fraud_checks.upsert({
    where: { transaction_id: tx2.transaction_id },
    update: {
      user_latitude: 13.82,
      user_longitude: 100.58,
      merchant_latitude: 13.75,
      merchant_longitude: 100.54,
      distance_meters: 8450.0,
      is_distance_valid: false,
      risk_score: 91.0,
      fraud_reason: 'Distance 8.45 km > 2km geofence; Device signature mismatch; Repeat anomaly',
      decision: 'FLAGGED_FOR_REVIEW',
    },
    create: {
      transaction_id: tx2.transaction_id,
      user_latitude: 13.82,
      user_longitude: 100.58,
      merchant_latitude: 13.75,
      merchant_longitude: 100.54,
      distance_meters: 8450.0,
      is_distance_valid: false,
      risk_score: 91.0,
      fraud_reason: 'Distance 8.45 km > 2km geofence; Device signature mismatch; Repeat anomaly',
      decision: 'FLAGGED_FOR_REVIEW',
    },
  });

  console.log('Fraud check 2 seeded.');
  console.log('All demo seed data ready!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
