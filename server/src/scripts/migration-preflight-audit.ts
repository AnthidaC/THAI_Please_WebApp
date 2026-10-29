import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function runPreflight() {
  console.log('=================================================================');
  console.log('🔍 PRE-FLIGHT AUDIT: DEV 3 REFERRAL UNIQUENESS MIGRATION DEPLOYMENT');
  console.log('=================================================================\n');

  let passed = true;

  try {
    // -------------------------------------------------------------
    // CHECK 1: Migration History & Bookkeeping in _prisma_migrations
    // -------------------------------------------------------------
    console.log('--- [CHECK 1] Deployed Migrations History in DB ---');
    const appliedMigrations = await prisma.$queryRaw<
      Array<{
        id: string;
        migration_name: string;
        finished_at: Date | null;
        applied_steps_count: number;
        rolled_back_at: Date | null;
      }>
    >`
      SELECT id, migration_name, finished_at, applied_steps_count, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at ASC
    `;

    console.log(`Found ${appliedMigrations.length} previously deployed migrations:`);
    for (const m of appliedMigrations) {
      const isFailed = !m.finished_at || m.rolled_back_at !== null;
      console.log(`  • ${m.migration_name} | Finished: ${m.finished_at ? m.finished_at.toISOString() : 'FAILED'} | RolledBack: ${m.rolled_back_at || 'None'}`);
      if (isFailed) {
        console.error(`❌ ERROR: Broken migration detected in history: ${m.migration_name}`);
        passed = false;
      }
    }

    // -------------------------------------------------------------
    // CHECK 2: Local Migrations Directory vs DB
    // -------------------------------------------------------------
    console.log('\n--- [CHECK 2] Local Migrations Directory Comparison ---');
    const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
    const localMigrationDirs = fs
      .readdirSync(migrationsDir)
      .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory() && d !== 'migration_lock.toml');

    console.log(`Local migration directories found (${localMigrationDirs.length}):`);
    localMigrationDirs.forEach((d) => console.log(`  - ${d}`));

    const appliedNames = new Set(appliedMigrations.map((m) => m.migration_name));
    const pendingMigrations = localMigrationDirs.filter((d) => !appliedNames.has(d));

    console.log(`\nPending migrations to be applied: ${pendingMigrations.length}`);
    pendingMigrations.forEach((p) => console.log(`  ⭐ Pending: ${p}`));

    const expectedTarget = '20261029220000_referrals_referee_merchant_uniqueness';
    if (pendingMigrations.length !== 1 || pendingMigrations[0] !== expectedTarget) {
      console.error(`❌ ERROR: Pending migrations mismatch! Expected exactly [${expectedTarget}], found:`, pendingMigrations);
      passed = false;
    } else {
      console.log(`✔ OK: Only target migration [${expectedTarget}] is pending.`);
    }

    // -------------------------------------------------------------
    // CHECK 3: Verify Target Migration SQL Content
    // -------------------------------------------------------------
    console.log('\n--- [CHECK 3] Migration SQL Safety & Scope ---');
    const targetSqlPath = path.join(migrationsDir, expectedTarget, 'migration.sql');
    if (!fs.existsSync(targetSqlPath)) {
      console.error(`❌ ERROR: migration.sql not found at: ${targetSqlPath}`);
      passed = false;
    } else {
      const sqlContent = fs.readFileSync(targetSqlPath, 'utf8');
      console.log('Migration SQL content:\n' + sqlContent);

      // Verify safety: no DROP, DELETE, TRUNCATE, or changes to other tables
      const dangerousPatterns = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i, /\bALTER\s+TABLE\s+(?!"referrals")/i];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(sqlContent)) {
          console.error(`❌ ERROR: Prohibited DDL/DML pattern found in migration: ${pattern}`);
          passed = false;
        }
      }

      // Check it specifically targets referrals table
      if (!sqlContent.includes('"referrals"')) {
        console.error('❌ ERROR: Migration does not target referrals table.');
        passed = false;
      }
      if (!sqlContent.includes('"uq_referrals_referee_merchant"')) {
        console.error('❌ ERROR: Migration does not define uq_referrals_referee_merchant index.');
        passed = false;
      }
      console.log('✔ OK: Migration SQL is non-destructive and safely scoped to referrals table.');
    }

    // -------------------------------------------------------------
    // CHECK 4: Read-Only Audit of referrals in DB
    // -------------------------------------------------------------
    console.log('\n--- [CHECK 4] Read-Only Referrals Data Audit ---');
    const totalReferrals = await prisma.referrals.count();
    console.log(`Total referrals records in DB: ${totalReferrals}`);

    const statusCounts = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM referrals
      GROUP BY status
    `;
    console.log('Status counts:');
    if (statusCounts.length === 0) {
      console.log('  (Table is currently empty)');
    } else {
      for (const sc of statusCounts) {
        console.log(`  • ${sc.status}: ${Number(sc.count)}`);
      }
    }

    // Check for existing duplicates on (referred_user_id, merchant_id)
    const duplicateRows = await prisma.$queryRaw<
      Array<{ referred_user_id: string; merchant_id: string; count: bigint; statuses: string }>
    >`
      SELECT referred_user_id, merchant_id, COUNT(*) as count, STRING_AGG(status, ', ') as statuses
      FROM referrals
      WHERE referred_user_id IS NOT NULL
        AND status IN ('pending', 'accepted', 'redeemed')
      GROUP BY referred_user_id, merchant_id
      HAVING COUNT(*) > 1
    `;

    if (duplicateRows.length > 0) {
      console.error(`❌ ERROR: Found ${duplicateRows.length} duplicate groups that violate the unique index!`);
      for (const d of duplicateRows) {
        console.error(`  - Referee: ${d.referred_user_id}, Merchant: ${d.merchant_id}, Count: ${Number(d.count)}, Statuses: ${d.statuses}`);
      }
      passed = false;
    } else {
      console.log('✔ OK: Zero duplicates found for (referred_user_id, merchant_id) in (pending, accepted, redeemed).');
    }

    // Check for expired active referrals
    const expiredActives = await prisma.$queryRaw<
      Array<{ referral_id: string; referral_code: string; status: string; expires_at: Date }>
    >`
      SELECT referral_id, referral_code, status, expires_at
      FROM referrals
      WHERE status IN ('pending', 'accepted')
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    `;
    console.log(`Expired in-flight referrals (status pending/accepted with past expires_at): ${expiredActives.length}`);
    if (expiredActives.length > 0) {
      console.log('  Note: Expired active records detected. They are preserved intact as per safety rules.');
      for (const ea of expiredActives) {
        console.log(`  • ID: ${ea.referral_id}, Code: ${ea.referral_code}, Status: ${ea.status}, ExpiresAt: ${ea.expires_at.toISOString()}`);
      }
    }

    // -------------------------------------------------------------
    // CHECK 5: Backup & Rollback Artifacts Readiness
    // -------------------------------------------------------------
    console.log('\n--- [CHECK 5] Backup / Rollback Script Readiness ---');
    const downSqlPath = path.join(migrationsDir, expectedTarget, 'down.sql');
    if (!fs.existsSync(downSqlPath)) {
      console.error(`❌ ERROR: down.sql rollback script not found at: ${downSqlPath}`);
      passed = false;
    } else {
      const downSql = fs.readFileSync(downSqlPath, 'utf8');
      console.log(`Rollback SQL found (${downSqlPath}):\n` + downSql.trim());
      console.log('✔ OK: Rollback script is ready.');
    }

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n=================================================================');
    if (passed) {
      console.log('🟢 PRE-FLIGHT AUDIT PASSED: READY FOR DEPLOYMENT');
    } else {
      console.log('🔴 PRE-FLIGHT AUDIT FAILED: DO NOT DEPLOY');
    }
    console.log('=================================================================');

  } catch (err) {
    console.error('❌ Exception during preflight audit:', err);
    passed = false;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(passed ? 0 : 1);
}

runPreflight();
