import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function runPostVerification() {
  console.log('=================================================================');
  console.log('🔍 POST-DEPLOYMENT VERIFICATION: SHARED SUPABASE');
  console.log('=================================================================\n');

  try {
    // 1. Verify migration recorded in _prisma_migrations
    console.log('--- 1. Checking _prisma_migrations record ---');
    const migrationRecord = await prisma.$queryRaw<
      Array<{
        id: string;
        migration_name: string;
        started_at: Date;
        finished_at: Date | null;
        applied_steps_count: number;
        rolled_back_at: Date | null;
      }>
    >`
      SELECT id, migration_name, started_at, finished_at, applied_steps_count, rolled_back_at
      FROM _prisma_migrations
      WHERE migration_name = '20261029220000_referrals_referee_merchant_uniqueness'
    `;

    if (migrationRecord.length === 1 && migrationRecord[0].finished_at && !migrationRecord[0].rolled_back_at) {
      console.log('✔ OK: Target migration is recorded as successfully finished:');
      console.log(`  • ID: ${migrationRecord[0].id}`);
      console.log(`  • Name: ${migrationRecord[0].migration_name}`);
      console.log(`  • Started: ${migrationRecord[0].started_at.toISOString()}`);
      console.log(`  • Finished: ${migrationRecord[0].finished_at.toISOString()}`);
    } else {
      console.error('❌ ERROR: Migration record not found or not finished:', migrationRecord);
      process.exit(1);
    }

    // 2. Verify unique index in pg_indexes
    console.log('\n--- 2. Verifying Index in PostgreSQL pg_indexes catalog ---');
    const indexRecord = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'referrals'
        AND indexname = 'uq_referrals_referee_merchant'
    `;

    if (indexRecord.length === 1) {
      console.log('✔ OK: Unique index "uq_referrals_referee_merchant" found in pg_indexes:');
      console.log(`  • Index Name: ${indexRecord[0].indexname}`);
      console.log(`  • Definition: ${indexRecord[0].indexdef}`);
    } else {
      console.error('❌ ERROR: Unique index "uq_referrals_referee_merchant" not found in pg_indexes!');
      process.exit(1);
    }

    // 3. Verify preservation of existing referrals data
    console.log('\n--- 3. Verifying Existing Referrals Data Preservation ---');
    const records = await prisma.referrals.findMany({
      orderBy: { created_at: 'asc' },
    });

    console.log(`Total referrals records in DB: ${records.length}`);
    if (records.length !== 2) {
      console.error(`❌ ERROR: Expected exactly 2 preserved records, found: ${records.length}`);
      process.exit(1);
    }

    const expectedCodes = ['TP-6MHEPQ', 'TP-VZV32E'];
    for (const r of records) {
      if (!expectedCodes.includes(r.referral_code)) {
        console.error(`❌ ERROR: Unexpected record code: ${r.referral_code}`);
        process.exit(1);
      }
      console.log(`  ✔ Preserved record: [${r.referral_code}] id: ${r.referral_id}, merchant: ${r.merchant_id}, status: ${r.status}`);
    }

    console.log('\n=================================================================');
    console.log('🟢 ALL POST-DEPLOYMENT VERIFICATION CHECKS PASSED');
    console.log('=================================================================');
  } catch (err) {
    console.error('❌ Error during post verification:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPostVerification();
