import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user_rewards.count();
  console.log('user_rewards count on Supabase:', count);
  const rewardsCount = await prisma.rewards.count();
  console.log('rewards count on Supabase:', rewardsCount);
}

main().finally(() => prisma.$disconnect());
