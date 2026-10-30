import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
  const collisions = await prisma.$queryRaw<Array<{ email: string; sources: string; count: bigint }>>`
    SELECT
      lower(identity.email) AS email,
      string_agg(DISTINCT identity.source, ', ' ORDER BY identity.source) AS sources,
      count(*)::bigint AS count
    FROM (
      SELECT email, 'merchant_application'::text AS source
      FROM merchant_applications
      WHERE status IN ('SUBMITTING', 'PENDING', 'APPROVED')
      UNION ALL
      SELECT email, 'staff_account'::text AS source
      FROM staff_accounts
    ) AS identity
    GROUP BY lower(identity.email)
    HAVING count(*) > 1
    ORDER BY email;
  `;

  console.log(JSON.stringify(collisions, (_key, value) => (
    typeof value === 'bigint' ? value.toString() : value
  ), 2));
};

main()
  .finally(async () => prisma.$disconnect());
