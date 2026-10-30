import 'dotenv/config';
import { hashPassword } from '../utils/bcrypt';
import { prisma } from '../utils/prisma';

const demoPassword = 'DevOnlyPass123!';

const seed = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Development seed is disabled unless NODE_ENV=development');
  }

  const passwordHash = await hashPassword(demoPassword);
  const staffAccounts = [
    { email: 'dev-staff@example.test', full_name: 'Demo Development Staff' },
    { email: 'dev-admin@example.test', full_name: 'Demo Development Admin' },
  ];

  for (const account of staffAccounts) {
    await prisma.staff_accounts.upsert({
      where: { email: account.email },
      update: { full_name: account.full_name, password_hash: passwordHash, role: 'ADMIN', is_active: true },
      create: { ...account, password_hash: passwordHash, role: 'ADMIN', is_active: true },
    });
  }

  const admin = await prisma.staff_accounts.findUniqueOrThrow({
    where: { email: 'dev-admin@example.test' },
    select: { staff_id: true },
  });

  const existingDemoMerchant = await prisma.merchants.findUnique({
    where: { tax_id: '0100000000001' },
    select: { merchant_id: true, shop_name: true },
  });
  if (existingDemoMerchant && existingDemoMerchant.shop_name !== 'Demo Approved Merchant') {
    throw new Error('The reserved development merchant tax ID is already used by a different shop');
  }

  const approvedMerchant = existingDemoMerchant
    ? await prisma.merchants.update({
      where: { merchant_id: existingDemoMerchant.merchant_id },
      data: { shop_name: 'Demo Approved Merchant', is_approved: true, approved_by_admin_id: admin.staff_id },
    })
    : await prisma.merchants.create({
      data: {
      tax_id: '0100000000001',
      shop_name: 'Demo Approved Merchant',
      latitude: 13.7563,
      longitude: 100.5018,
      is_approved: true,
      approved_by_admin_id: admin.staff_id,
      },
    });

  const applications = [
    {
      email: 'dev-merchant-approved@example.test',
      businessName: 'Demo Approved Merchant',
      taxId: '0100000000001',
      status: 'APPROVED',
      merchantId: approvedMerchant.merchant_id,
      rejectionReason: null,
    },
    {
      email: 'dev-merchant-pending@example.test',
      businessName: 'Demo Pending Merchant',
      taxId: '0100000000002',
      status: 'PENDING',
      merchantId: null,
      rejectionReason: null,
    },
    {
      email: 'dev-merchant-rejected@example.test',
      businessName: 'Demo Rejected Merchant',
      taxId: '0100000000003',
      status: 'REJECTED',
      merchantId: null,
      rejectionReason: 'Please provide a clearer proof of the business bank account.',
    },
  ] as const;

  for (const application of applications) {
    const existing = await prisma.merchantApplication.findFirst({
      where: { email: application.email },
      select: { application_id: true },
    });
    const data = {
      business_type: 'INDIVIDUAL',
      tax_id: application.taxId,
      shop_name: application.businessName,
      contact_name: 'Demo Test Contact',
      email: application.email,
      phone: '0800000000',
      password_hash: passwordHash,
      address: 'Demo address, Bangkok',
      latitude: 13.7563,
      longitude: 100.5018,
      status: application.status,
      rejection_reason: application.rejectionReason,
      merchant_id: application.merchantId,
      reviewed_by_staff_id: application.status === 'PENDING' ? null : admin.staff_id,
      reviewed_at: application.status === 'PENDING' ? null : new Date(),
    };

    if (existing) {
      await prisma.merchantApplication.update({ where: existing, data });
    } else {
      await prisma.merchantApplication.create({ data });
    }
  }

  console.info('Created development onboarding accounts. Password is documented in the development setup section.');
};

seed()
  .catch((error: unknown) => {
    console.error('Development seed failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
