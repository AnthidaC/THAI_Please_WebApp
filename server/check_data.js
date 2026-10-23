const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  console.log('User:', user?.national_id, user?.user_id, user?.role);
  const merchant = await prisma.merchants.findFirst();
  console.log('Merchant:', merchant?.shop_name, merchant?.merchant_id);
  const campaign = await prisma.campaigns.findFirst();
  console.log('Campaign:', campaign?.campaign_name, campaign?.campaign_id);
  const wallet = await prisma.wallets.findFirst();
  console.log('Wallet:', wallet?.wallet_id, wallet?.balance);
  const txCount = await prisma.transactions.count();
  console.log('Tx Count:', txCount);
  const fraudCount = await prisma.fraud_checks.count();
  console.log('Fraud checks count:', fraudCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
