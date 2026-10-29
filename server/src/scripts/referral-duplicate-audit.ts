import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function runReadOnlyAudit() {
  console.log('=== [READ-ONLY AUDIT] Referrals Table on Shared Supabase ===\n');

  try {
    // 1. Total records and null stats
    const totalCount = await prisma.referrals.count();
    const withReferredUser = await prisma.referrals.count({
      where: { referred_user_id: { not: null } },
    });
    const unassignedCodes = await prisma.referrals.count({
      where: { referred_user_id: null },
    });
    const withMerchant = await prisma.referrals.count({
      where: { merchant_id: { not: null } },
    });
    const withoutMerchant = await prisma.referrals.count({
      where: { merchant_id: null },
    });

    console.log(`📊 Total referrals in DB: ${totalCount}`);
    console.log(`   - With referred_user_id (assigned): ${withReferredUser}`);
    console.log(`   - Without referred_user_id (unassigned): ${unassignedCodes}`);
    console.log(`   - With merchant_id: ${withMerchant}`);
    console.log(`   - Without merchant_id: ${withoutMerchant}`);

    // 2. Status distribution
    console.log('\n📊 Status Distribution:');
    const statusGroups = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM referrals
      GROUP BY status
      ORDER BY count DESC
    `;
    for (const group of statusGroups) {
      console.log(`   - Status "${group.status}": ${Number(group.count)} records`);
    }

    // 3. Expiration analysis (expires_at vs NOW())
    const expiredCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM referrals
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `;
    console.log(`\n⏳ Expired by expires_at timestamp (< NOW()): ${Number(expiredCount[0]?.count || 0)} records`);

    // 4. Duplicate Check: (referred_user_id, merchant_id)
    console.log('\n🔍 Auditing for existing duplicates on (referred_user_id, merchant_id)...');
    const duplicates = await prisma.$queryRaw<
      Array<{ referred_user_id: string; merchant_id: string; duplicate_count: bigint; statuses: string }>
    >`
      SELECT 
        referred_user_id,
        merchant_id,
        COUNT(*) as duplicate_count,
        STRING_AGG(status, ', ') as statuses
      FROM referrals
      WHERE referred_user_id IS NOT NULL
      GROUP BY referred_user_id, merchant_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      console.log('✅ ZERO DUPLICATES FOUND on (referred_user_id, merchant_id)!');
      console.log('   The proposed unique index "uq_referrals_referee_merchant" can be safely created without index build collision.');
    } else {
      console.log(`⚠️ FOUND ${duplicates.length} DUPLICATE GROUPS!`);
      for (const d of duplicates) {
        console.log(`   - Referee: ${d.referred_user_id}, Merchant: ${d.merchant_id}, Count: ${Number(d.duplicate_count)}, Statuses: [${d.statuses}]`);
      }
    }

    // 5. Existing constraints and indexes on referrals table
    console.log('\n🔍 Existing Indexes on "referrals" table:');
    const existingIndexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'referrals'
      ORDER BY indexname
    `;
    for (const idx of existingIndexes) {
      console.log(`   - ${idx.indexname}: ${idx.indexdef}`);
    }

  } catch (error) {
    console.error('❌ Error during read-only audit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runReadOnlyAudit();
