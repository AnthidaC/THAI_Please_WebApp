import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Database connection is not configured');
  if ((new URL(url).searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('This deployment script expects the public schema');
  }
  const db = new PrismaClient({ datasourceUrl: url, log: [] });
  try {
    const tables = await db.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
      SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('payment_pins', 'payment_qr_codes')`;
    const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_transactions_paid_qr_reference'`;
    const duplicates = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM (
        SELECT qr_reference FROM transactions
        WHERE qr_reference IS NOT NULL AND status IN ('SUCCESS', 'FLAGGED')
        GROUP BY qr_reference HAVING COUNT(*) > 1
      ) AS duplicate_references`;
    console.log(JSON.stringify({
      paymentPins: tables.some(table => table.tablename === 'payment_pins'),
      durableQr: tables.some(table => table.tablename === 'payment_qr_codes'),
      rowLevelSecurity: tables.length === 2 && tables.every(table => table.rowsecurity),
      uniquePaidQrIndex: indexes.length === 1,
      duplicatePaidQrReferences: Number(duplicates[0].count),
    }, null, 2));
    if (!process.argv.includes('--apply')) return;
    if (tables.length === 2 && indexes.length === 1 && tables.every(table => table.rowsecurity)) {
      console.log('Payment schema is already installed. No changes made.');
      return;
    }
    if (tables.length || indexes.length) throw new Error('Partial payment schema already exists; inspect it before applying. No changes made.');
    if (Number(duplicates[0].count)) throw new Error('Existing paid QR references are duplicated; review them before adding the unique index. No changes made.');
    const migration = readFileSync(path.join(__dirname, '../../prisma/migrations/202610270001_payment_pin_and_qr/migration.sql'), 'utf8');
    const statements = migration.replace(/^\s*--.*$/gm, '').split(';').map(statement => statement.trim()).filter(Boolean);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('thaiplease_dev2_payment_schema'))`;
      for (const statement of statements) {
        if (statement !== 'BEGIN' && statement !== 'COMMIT') await tx.$executeRawUnsafe(statement);
      }
    }, { timeout: 30000 });
    console.log('Installed payment_pins, payment_qr_codes, RLS, and the paid-QR unique index. Existing rows were preserved.');
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
