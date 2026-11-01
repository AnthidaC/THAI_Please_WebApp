import { createHash } from 'node:crypto';
import { hashPassword } from '../utils/bcrypt';
import { prisma } from '../utils/prisma';

const demoPassword = 'DevOnlyPass123!';
const demoPin = '123456';

const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

export async function seedAutoDocker(): Promise<void> {
  console.log('🌱 Starting automated Docker database seed...');

  const passwordHash = await hashPassword(demoPassword);
  const pinHash = await hashPassword(demoPin);

  // 1. Categories
  console.log('  -> Seeding canonical master categories...');
  const categories = [
    { category_id: 'FOOD', category_name_th: 'ร้านอาหารทั่วไป' },
    { category_id: 'STREET_FOOD', category_name_th: 'อาหารริมทาง' },
    { category_id: 'BAKERY_DESSERT', category_name_th: 'ขนมหวานและเบเกอรี่' },
    { category_id: 'BEVERAGE', category_name_th: 'เครื่องดื่ม' },
    { category_id: 'GENERAL_GOODS', category_name_th: 'สินค้าทั่วไป' },
  ];

  for (const cat of categories) {
    await prisma.categories.upsert({
      where: { category_id: cat.category_id },
      update: { category_name_th: cat.category_name_th, is_active: true },
      create: { category_id: cat.category_id, category_name_th: cat.category_name_th, is_active: true },
    });
  }

  // 2. Condition Types
  console.log('  -> Seeding condition types...');
  const conditionTypes = [
    { condition_key: 'transaction_count', display_name: 'จำนวนรายการที่สำเร็จ', description: 'นับรายการใช้จ่ายที่ผ่านเกณฑ์ของโครงการ', measurement_unit: 'count', implementation_status: 'ready' },
    { condition_key: 'referral_count', display_name: 'จำนวนผู้ใช้ที่แนะนำ', description: 'นับผู้ใช้ที่สมัครและทำรายการตามเงื่อนไขการแนะนำเพื่อน', measurement_unit: 'count', implementation_status: 'ready' },
    { condition_key: 'review_count', display_name: 'จำนวนรีวิวจากการซื้อ', description: 'นับรีวิวจากรายการซื้อที่ผ่านการตรวจสอบแล้ว', measurement_unit: 'count', implementation_status: 'ready' },
    { condition_key: 'total_spending', display_name: 'ยอดใช้จ่ายสะสม', description: 'รวมยอดใช้จ่ายของรายการที่ผ่านเกณฑ์', measurement_unit: 'amount', implementation_status: 'ready' },
  ];

  for (const ct of conditionTypes) {
    await prisma.condition_types.upsert({
      where: { condition_key: ct.condition_key },
      update: { display_name: ct.display_name, description: ct.description, measurement_unit: ct.measurement_unit, implementation_status: ct.implementation_status },
      create: ct,
    });
  }

  // 3. Badges & Badge Tiers
  console.log('  -> Seeding badges & badge tiers...');
  const badgeDefinitions = [
    { name: 'นักช้อปชุมชน', condition: 'transaction_count', desc: 'สะสมการใช้จ่ายกับร้านค้าในโครงการ', thresholds: [3, 10, 25, 50] },
    { name: 'เสียงจากชุมชน', condition: 'review_count', desc: 'เขียนรีวิวร้านค้าชุมชนที่ไปอุดหนุน', thresholds: [1, 5, 15, 30] },
    { name: 'ชวนเพื่อนอุดหนุน', condition: 'referral_count', desc: 'แนะนำเพื่อนเข้าร่วมโครงการไทยช่วยไทย', thresholds: [1, 3, 5, 10] },
    { name: 'พลังเงินหมุนเวียน', condition: 'total_spending', desc: 'ยอดใช้จ่ายรวมในโครงการ', thresholds: [500, 1500, 3000, 5000] },
  ];

  const tierNames = ['Bronze', 'Silver', 'Gold', 'Platinum'];

  for (const b of badgeDefinitions) {
    const badge = await prisma.badges.upsert({
      where: { condition_type: b.condition },
      update: { badge_name: b.name, description: b.desc, status: 'active', implementation_status: 'ready' },
      create: {
        badge_name: b.name,
        condition_type: b.condition,
        description: b.desc,
        status: 'active',
        implementation_status: 'ready',
      },
    });

    for (let i = 0; i < tierNames.length; i++) {
      const level = i + 1;
      const req = b.thresholds[i];
      const existingTier = await prisma.badge_tiers.findFirst({
        where: { badge_id: badge.badge_id, tier_level: level },
      });

      if (!existingTier) {
        await prisma.badge_tiers.create({
          data: {
            badge_id: badge.badge_id,
            tier_name: tierNames[i],
            tier_level: level,
            required_count: req,
            icon_url: `/icons/badges/${tierNames[i].toLowerCase()}.svg`,
          },
        });
      }
    }
  }

  // 4. Main Campaign & Periods
  console.log('  -> Seeding main campaign & periods...');
  const campaign = await prisma.campaigns.upsert({
    where: { campaign_id: CAMPAIGN_ID },
    update: {
      campaign_name: 'โครงการไทยช่วยไทยพลีส (THAI Please Co-pay 60/40)',
      government_copay_rate_percent: 60,
      citizen_payment_rate_percent: 40,
      daily_quota_limit: 150,
      total_quota_limit: 3000,
      status: 'ACTIVE',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.000Z'),
    },
    create: {
      campaign_id: CAMPAIGN_ID,
      campaign_name: 'โครงการไทยช่วยไทยพลีส (THAI Please Co-pay 60/40)',
      government_copay_rate_percent: 60,
      citizen_payment_rate_percent: 40,
      daily_quota_limit: 150,
      total_quota_limit: 3000,
      status: 'ACTIVE',
      start_date: new Date('2026-01-01T00:00:00.000Z'),
      end_date: new Date('2026-12-31T23:59:59.000Z'),
    },
  });

  // Create monthly period
  const currentPeriod = await prisma.campaign_periods.upsert({
    where: { period_id: '22222222-2222-2222-2222-222222222222' },
    update: {
      period_name: 'พฤศจิกายน 2569 (Period 1)',
      period_quota_limit: 1000,
      start_date: new Date('2026-11-01T00:00:00.000Z'),
      end_date: new Date('2026-11-30T23:59:59.000Z'),
    },
    create: {
      period_id: '22222222-2222-2222-2222-222222222222',
      campaign_id: campaign.campaign_id,
      period_name: 'พฤศจิกายน 2569 (Period 1)',
      period_quota_limit: 1000,
      start_date: new Date('2026-11-01T00:00:00.000Z'),
      end_date: new Date('2026-11-30T23:59:59.000Z'),
    },
  });

  // 5. Admin Staff Accounts
  console.log('  -> Seeding admin staff accounts...');
  const adminAccount = await prisma.staff_accounts.upsert({
    where: { email: 'dev-admin@example.test' },
    update: { full_name: 'Demo Development Admin', password_hash: passwordHash, role: 'ADMIN', is_active: true },
    create: {
      email: 'dev-admin@example.test',
      full_name: 'Demo Development Admin',
      password_hash: passwordHash,
      role: 'ADMIN',
      is_active: true,
    },
  });

  await prisma.auth_identities.upsert({
    where: { account_type_account_id: { account_type: 'STAFF_ACCOUNT', account_id: adminAccount.staff_id } },
    update: { email: adminAccount.email },
    create: {
      account_type: 'STAFF_ACCOUNT',
      account_id: adminAccount.staff_id,
      email: adminAccount.email,
    },
  });

  // 6. Demo Approved Merchant
  console.log('  -> Seeding demo merchants...');
  const merchantTaxId = '0100000000001';
  const existingMerchant = await prisma.merchants.findUnique({ where: { tax_id: merchantTaxId } });

  const merchant = existingMerchant
    ? await prisma.merchants.update({
        where: { merchant_id: existingMerchant.merchant_id },
        data: {
          shop_name: 'Demo Approved Merchant',
          category_id: 'FOOD',
          latitude: 13.7563,
          longitude: 100.5018,
          average_rating_stars: 4.8,
          digital_credit_score: 95,
          is_approved: true,
          approved_by_admin_id: adminAccount.staff_id,
        },
      })
    : await prisma.merchants.create({
        data: {
          tax_id: merchantTaxId,
          shop_name: 'Demo Approved Merchant',
          category_id: 'FOOD',
          latitude: 13.7563,
          longitude: 100.5018,
          average_rating_stars: 4.8,
          digital_credit_score: 95,
          is_approved: true,
          approved_by_admin_id: adminAccount.staff_id,
        },
      });

  const existingApp = await prisma.merchantApplication.findFirst({
    where: { email: 'dev-merchant-approved@example.test' },
  });

  const merchantApp = existingApp
    ? await prisma.merchantApplication.update({
        where: { application_id: existingApp.application_id },
        data: {
          merchant_id: merchant.merchant_id,
          shop_name: 'Demo Approved Merchant',
          category_id: 'FOOD',
          status: 'APPROVED',
          password_hash: passwordHash,
        },
      })
    : await prisma.merchantApplication.create({
        data: {
          merchant_id: merchant.merchant_id,
          email: 'dev-merchant-approved@example.test',
          shop_name: 'Demo Approved Merchant',
          business_type: 'INDIVIDUAL',
          contact_name: 'เจ้าของร้านสมบูรณ์',
          phone: '0812345678',
          address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร',
          latitude: 13.7563,
          longitude: 100.5018,
          category_id: 'FOOD',
          tax_id: merchantTaxId,
          status: 'APPROVED',
          password_hash: passwordHash,
        },
      });

  await prisma.auth_identities.upsert({
    where: { account_type_account_id: { account_type: 'MERCHANT_ACCOUNT', account_id: merchant.merchant_id } },
    update: { email: merchantApp.email },
    create: {
      account_type: 'MERCHANT_ACCOUNT',
      account_id: merchant.merchant_id,
      email: merchantApp.email,
    },
  });

  // Also create a second Pending Merchant for admin approval testing
  const pendingTaxId = '0100000000002';
  const existingPendingApp = await prisma.merchantApplication.findFirst({
    where: { email: 'dev-merchant-pending@example.test' },
  });
  if (!existingPendingApp) {
    await prisma.merchantApplication.create({
      data: {
        email: 'dev-merchant-pending@example.test',
        shop_name: 'Demo Pending Merchant (รออนุมัติ)',
        business_type: 'INDIVIDUAL',
        contact_name: 'ป้าแดง ขายส้มตำ',
        phone: '0898765432',
        address: '456 ซอยอารีย์ แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร',
        latitude: 13.7797,
        longitude: 100.5451,
        category_id: 'STREET_FOOD',
        tax_id: pendingTaxId,
        status: 'PENDING',
        password_hash: passwordHash,
      },
    });
  }

  // 7. Demo Citizens
  console.log('  -> Seeding demo citizens...');
  const demoCitizens = [
    {
      name: 'นายสมชาย ใจดี [Demo]',
      email: 'demo-citizen@example.test',
      cid: '1100500123456',
      province: '10',
    },
    {
      name: 'น.ส.สมศรี มีสุข [Demo]',
      email: 'demo-citizen2@example.test',
      cid: '1100500654321',
      province: '10',
    },
  ];

  for (const c of demoCitizens) {
    const cidHash = createHash('sha256').update(c.cid).digest('hex');
    let user = await prisma.user.findFirst({ where: { citizen_id_hash: cidHash } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          full_name: c.name,
          citizen_id_hash: cidHash,
          province_code: c.province,
          is_registered_thai_plus: true,
        },
      });
    }

    // Auth Identity
    await prisma.auth_identities.upsert({
      where: { account_type_account_id: { account_type: 'CITIZEN_ACCOUNT', account_id: user.user_id } },
      update: { email: c.email },
      create: {
        account_type: 'CITIZEN_ACCOUNT',
        account_id: user.user_id,
        email: c.email,
      },
    });

    // Citizen credentials (login password)
    await prisma.citizen_credentials.upsert({
      where: { user_id: user.user_id },
      update: { password_hash: passwordHash },
      create: {
        user_id: user.user_id,
        password_hash: passwordHash,
      },
    });

    // Payment PIN (123456)
    await prisma.payment_pins.upsert({
      where: { user_id: user.user_id },
      update: { pin_hash: pinHash, failed_attempts: 0, locked_until: null },
      create: {
        user_id: user.user_id,
        pin_hash: pinHash,
      },
    });

    // Wallet
    let wallet = await prisma.wallets.findUnique({ where: { user_id: user.user_id } });
    if (!wallet) {
      wallet = await prisma.wallets.create({
        data: {
          user_id: user.user_id,
          campaign_id: campaign.campaign_id,
          balance: 2000.0,
          daily_quota_limit: 150.0,
          daily_quota_used: 0.0,
          total_quota_remaining: 3000.0,
          eligibility_status: 'ELIGIBLE',
          status: 'ACTIVE',
        },
      });
    }

    // Wallet Period Quota
    await prisma.wallet_period_quotas.upsert({
      where: { wallet_id_period_id: { wallet_id: wallet.wallet_id, period_id: currentPeriod.period_id } },
      update: { quota_limit: 1000.0, quota_used: 0.0, quota_remaining: 1000.0 },
      create: {
        wallet_id: wallet.wallet_id,
        period_id: currentPeriod.period_id,
        quota_limit: 1000.0,
        quota_used: 0.0,
        quota_remaining: 1000.0,
      },
    });
  }

  // 8. Missions & Rewards
  console.log('  -> Seeding missions & rewards...');
  const mockMissions = [
    {
      name: 'ทำรายการที่สำเร็จครบ 5 ครั้ง [Demo]',
      description: 'ทำรายการซื้อที่สำเร็จจากร้านค้าที่เข้าร่วมให้ครบ 5 ครั้งในช่วงเวลาภารกิจ',
      conditionType: 'transaction_count',
      targetValue: 5,
      rewardName: 'ส่วนลดนักช้อปชุมชน 10%',
      discountValue: 10,
      discountType: 'PERCENTAGE',
    },
    {
      name: 'ใช้จ่ายสะสมครบ 250 บาท [Demo]',
      description: 'สะสมยอดเงินที่จ่ายจริงจากการซื้อสินค้าให้ครบ 250 บาทในช่วงเวลาภารกิจ',
      conditionType: 'total_spending',
      targetValue: 250,
      rewardName: 'ส่วนลดผู้ใช้จ่ายสะสม 50 บาท',
      discountValue: 50,
      discountType: 'FIXED_AMOUNT',
    },
    {
      name: 'เขียนรีวิวจากการซื้อครบ 1 รีวิว [Demo]',
      description: 'เขียนรีวิวจากการซื้อที่ตรวจสอบแล้วให้ครบ 1 รีวิวในช่วงเวลาภารกิจ',
      conditionType: 'review_count',
      targetValue: 1,
      rewardName: 'ส่วนลดนักรีวิวชุมชน 15%',
      discountValue: 15,
      discountType: 'PERCENTAGE',
    },
    {
      name: 'แนะนำเพื่อนที่ซื้อสำเร็จครบ 2 คน [Demo]',
      description: 'แนะนำเพื่อนที่ทำรายการซื้อสำเร็จให้ครบ 2 คนในช่วงเวลาภารกิจ',
      conditionType: 'referral_count',
      targetValue: 2,
      rewardName: 'ส่วนลดขอบคุณผู้แนะนำ 20 บาท',
      discountValue: 20,
      discountType: 'FIXED_AMOUNT',
    },
  ];

  for (const item of mockMissions) {
    const existingQuest = await prisma.quests.findFirst({ where: { quest_name: item.name } });
    if (!existingQuest) {
      const reward = await prisma.rewards.create({
        data: {
          reward_name: item.rewardName,
          reward_type: 'DISCOUNT_VOUCHER',
          discount_type: item.discountType,
          discount_value: item.discountValue,
          status: 'ACTIVE',
        },
      });

      await prisma.quests.create({
        data: {
          quest_name: item.name,
          description: item.description,
          condition_type: item.conditionType,
          target_value: item.targetValue,
          reward_id: reward.reward_id,
          starts_at: new Date('2026-01-01T00:00:00.000Z'),
          ends_at: new Date('2026-12-31T23:59:59.000Z'),
          status: 'ACTIVE',
        },
      });
    }
  }

  console.log('✅ Automated Docker seed completed successfully!');
}

if (process.argv[1]?.endsWith('seed-auto-docker.ts') || process.argv[1]?.endsWith('seed-auto-docker.js')) {
  seedAutoDocker()
    .catch((err) => {
      console.error('❌ Error during auto seed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
