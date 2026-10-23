import 'dotenv/config';
import { hashPassword } from '../utils/bcrypt';
import prisma from '../utils/prisma';

const bootstrapStaff = async (): Promise<void> => {
  const email = process.env.BOOTSTRAP_STAFF_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_STAFF_PASSWORD;
  const fullName = process.env.BOOTSTRAP_STAFF_NAME?.trim();
  const role = process.env.BOOTSTRAP_STAFF_ROLE ?? 'ADMIN';

  if (!email || !password || !fullName) {
    throw new Error('Set BOOTSTRAP_STAFF_EMAIL, BOOTSTRAP_STAFF_PASSWORD, and BOOTSTRAP_STAFF_NAME');
  }
  if (password.length < 12) throw new Error('Bootstrap password must contain at least 12 characters');
  if (role !== 'ADMIN' && role !== 'STAFF') throw new Error('BOOTSTRAP_STAFF_ROLE must be ADMIN or STAFF');

  const existing = await prisma.staff_accounts.findUnique({ where: { email } });
  if (existing) throw new Error('A staff account with this email already exists');

  const staff = await prisma.staff_accounts.create({
    data: {
      email,
      full_name: fullName,
      password_hash: await hashPassword(password),
      role,
    },
    select: { email: true, role: true },
  });
  console.info(`Created ${staff.role} staff account: ${staff.email}`);
};

bootstrapStaff()
  .catch((error: unknown) => {
    console.error('Staff bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
