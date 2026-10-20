const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // 1. Campaign
  const campaign = await prisma.campaigns.upsert({
    where: { campaign_id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      campaign_id: '11111111-1111-1111-1111-111111111111',
      campaign_name: 'โครงการคนละครึ่ง เฟสพิเศษ (THAI Please Co-pay)',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-12-31'),
      government_copay_rate_percent: 50.0,
      citizen_payment_rate_percent: 50.0,
      daily_quota_limit: 150.0,
      total_quota_limit: 3000.0,
      status: 'ACTIVE',
    },
  });
  console.log('Campaign ready:', campaign.campaign_name);

  // 2. User & Wallet
  const user = await prisma.user.findFirst();
  if (user) {
    await prisma.wallets.updateMany({
      where: { user_id: user.user_id },
      data: {
        campaign_id: campaign.campaign_id,
        balance: 1450.0,
      },
    });
  }

  // 3. Merchant
  const merchant = await prisma.merchants.findFirst();

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
