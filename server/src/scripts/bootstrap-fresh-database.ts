import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const PERIOD_MIGRATION = '20261027140000_campaign_period_quota_enforcement';
const LAST_PRE_PERIOD_MIGRATION = '20261027130000_remove_legacy_badge_tables';
const serverDirectory = process.cwd();
const prismaDirectory = path.join(serverDirectory, 'prisma');
const schemaPath = path.join(prismaDirectory, 'schema.prisma');
const migrationDirectory = path.join(prismaDirectory, 'migrations');
const bootstrapSqlPath = path.join(prismaDirectory, 'bootstrap', 'campaign_period_tables.sql');
const prismaCliPath = path.join(serverDirectory, 'node_modules', 'prisma', 'build', 'index.js');

type DatabaseState = {
  database_name: string;
  public_table_count: bigint;
  migrations_table_exists: boolean;
  campaign_periods_exists: boolean;
  wallet_period_quotas_exists: boolean;
  campaigns_exists: boolean;
  wallets_exists: boolean;
  anon_role_exists: boolean;
  authenticated_role_exists: boolean;
};

function parseApplyFlag(args: string[]): boolean {
  const unknown = args.filter((argument) => argument !== '--apply');
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  return args.includes('--apply');
}

function safeOutput(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, '[database URL redacted]@')
    .replace(/password=[^\s;]+/gi, 'password=[redacted]');
}

function runPrisma(args: string[]): void {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    cwd: serverDirectory,
    env: process.env,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(safeOutput(result.stdout));
  if (result.stderr) process.stderr.write(safeOutput(result.stderr));
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Prisma command failed: prisma ${args.join(' ')}`);
}

function assertExpectedFreshDatabase(state: DatabaseState): void {
  if (!state.anon_role_exists || !state.authenticated_role_exists) {
    throw new Error('Fresh replay requires the Supabase roles anon and authenticated.');
  }
  if (state.public_table_count !== 0n || state.migrations_table_exists ||
      state.campaign_periods_exists || state.wallet_period_quotas_exists ||
      state.campaigns_exists || state.wallets_exists) {
    throw new Error('Bootstrap only accepts an empty public schema with no Prisma migration history.');
  }
}

async function getDatabaseState(client: PrismaClient): Promise<DatabaseState> {
  const [state] = await client.$queryRaw<DatabaseState[]>`
    SELECT current_database() AS database_name,
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_table_count,
      to_regclass('public._prisma_migrations') IS NOT NULL AS migrations_table_exists,
      to_regclass('public.campaign_periods') IS NOT NULL AS campaign_periods_exists,
      to_regclass('public.wallet_period_quotas') IS NOT NULL AS wallet_period_quotas_exists,
      to_regclass('public.campaigns') IS NOT NULL AS campaigns_exists,
      to_regclass('public.wallets') IS NOT NULL AS wallets_exists,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS anon_role_exists,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AS authenticated_role_exists
  `;
  return state;
}

function getMigrations(): string[] {
  return readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function makeStagedMigrationDirectory(migrations: string[]): string {
  const beforeGap = migrations.filter((migration) => migration < PERIOD_MIGRATION);
  assert.equal(beforeGap.at(-1), LAST_PRE_PERIOD_MIGRATION,
    'The staged history must stop immediately before the first migration that requires campaign period tables.');

  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'thai-please-period-bootstrap-'));
  const stagedPrismaDirectory = path.join(temporaryRoot, 'prisma');
  const stagedMigrationDirectory = path.join(stagedPrismaDirectory, 'migrations');
  mkdirSync(stagedMigrationDirectory, { recursive: true });
  cpSync(schemaPath, path.join(stagedPrismaDirectory, 'schema.prisma'));
  const migrationLockPath = path.join(migrationDirectory, 'migration_lock.toml');
  if (existsSync(migrationLockPath)) {
    cpSync(migrationLockPath, path.join(stagedMigrationDirectory, 'migration_lock.toml'));
  }
  for (const migration of beforeGap) {
    cpSync(path.join(migrationDirectory, migration), path.join(stagedMigrationDirectory, migration), { recursive: true });
  }
  return path.join(stagedPrismaDirectory, 'schema.prisma');
}

async function main(): Promise<void> {
  const apply = parseApplyFlag(process.argv.slice(2));
  if (!process.env.DIRECT_URL) throw new Error('DIRECT_URL must be configured for migration commands.');
  for (const requiredPath of [schemaPath, bootstrapSqlPath, prismaCliPath]) {
    if (!existsSync(requiredPath)) throw new Error(`Required repository file is missing: ${requiredPath}`);
  }
  assert(statSync(bootstrapSqlPath).size > 0, 'Bootstrap SQL must not be empty.');

  const client = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL, log: [] });
  let temporarySchemaPath: string | undefined;
  let temporaryRoot: string | undefined;
  try {
    const state = await getDatabaseState(client);
    assertExpectedFreshDatabase(state);
    const migrations = getMigrations();
    if (!migrations.includes(PERIOD_MIGRATION)) throw new Error(`Missing migration directory ${PERIOD_MIGRATION}.`);
    const beforeGap = migrations.filter((migration) => migration < PERIOD_MIGRATION);

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      database: state.database_name,
      targetIsEmpty: true,
      firstPeriodTableMigration: PERIOD_MIGRATION,
      stagedMigrations: beforeGap,
      bootstrapSql: path.relative(serverDirectory, bootstrapSqlPath),
      finalAction: 'Apply the complete repository migration history with Prisma.',
    }, null, 2));
    if (!apply) return;

    temporarySchemaPath = makeStagedMigrationDirectory(migrations);
    temporaryRoot = path.dirname(path.dirname(temporarySchemaPath));

    runPrisma(['migrate', 'deploy', '--schema', temporarySchemaPath]);
    const postStage = await getDatabaseState(client);
    if (!postStage.migrations_table_exists || !postStage.campaigns_exists || !postStage.wallets_exists ||
        postStage.campaign_periods_exists || postStage.wallet_period_quotas_exists) {
      throw new Error('Staged migrations did not leave the expected pre-period schema.');
    }

    runPrisma(['db', 'execute', '--file', bootstrapSqlPath, '--schema', schemaPath]);
    const postBootstrap = await getDatabaseState(client);
    if (!postBootstrap.campaign_periods_exists || !postBootstrap.wallet_period_quotas_exists) {
      throw new Error('Campaign period bootstrap did not create both required tables.');
    }

    runPrisma(['migrate', 'deploy', '--schema', schemaPath]);
    runPrisma(['migrate', 'status', '--schema', schemaPath]);
  } finally {
    await client.$disconnect();
    if (temporaryRoot) {
      const resolvedTemp = path.resolve(temporaryRoot);
      const resolvedOsTemp = path.resolve(os.tmpdir()) + path.sep;
      if (resolvedTemp.startsWith(resolvedOsTemp)) rmSync(resolvedTemp, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
