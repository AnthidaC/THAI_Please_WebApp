const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE fraud_checks DROP CONSTRAINT IF EXISTS fraud_checks_decision_check;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE fraud_checks ADD CONSTRAINT fraud_checks_decision_check CHECK (decision IN ('AUTO_APPROVED', 'FLAGGED_FOR_REVIEW', 'FLAGGED_REVIEW', 'REJECTED', 'APPROVED_BY_ADMIN', 'REJECTED_BY_ADMIN'));`);
  await prisma.$executeRawUnsafe(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'FLAGGED', 'FLAGGED_FRAUD', 'REJECTED'));`);
  console.log('Constraints successfully updated to be flexible!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
