import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const records = await prisma.referrals.findMany();
  console.log('Existing Referrals in DB:');
  console.log(JSON.stringify(records, null, 2));
}

main().finally(() => prisma.$disconnect());
