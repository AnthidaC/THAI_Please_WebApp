import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';

const TEST_DATABASE_URL = 'postgresql://postgres_test:test_password_merchant_cat@localhost:5433/thai_please_test_db?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DATABASE_URL,
    },
  },
});

async function runMasterCategoriesVerification() {
  console.log('=== Starting Master Categories Test Verification on Isolated Test DB ===\n');

  // 1. Verify exactly 5 canonical categories in categories table
  console.log('Test 1: Verifying 5 canonical categories...');
  const categories: any = await prisma.$queryRawUnsafe(
    'SELECT category_id, category_name_th, is_active FROM "categories" ORDER BY category_id ASC;'
  );
  assert.equal(categories.length, 5, `Expected 5 categories, got ${categories.length}`);

  const expectedCategories: Record<string, string> = {
    BAKERY_DESSERT: 'ขนมหวานและเบเกอรี่',
    BEVERAGE: 'เครื่องดื่ม',
    FOOD: 'ร้านอาหารทั่วไป',
    GENERAL_GOODS: 'สินค้าทั่วไป',
    STREET_FOOD: 'อาหารริมทาง',
  };

  for (const cat of categories) {
    assert.ok(expectedCategories[cat.category_id], `Unexpected category_id: ${cat.category_id}`);
    assert.equal(cat.category_name_th, expectedCategories[cat.category_id]);
    assert.equal(cat.is_active, true);
  }
  console.log('✔ Passed: Exactly 5 canonical categories verified with accurate Thai names and is_active=true.');

  // 2. Verify Foreign Keys in PostgreSQL catalog
  console.log('\nTest 2: Verifying Foreign Key constraints in PostgreSQL information_schema...');
  const foreignKeys: any = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'categories'
    ORDER BY tc.table_name ASC;
  `);

  assert.equal(foreignKeys.length, 3, `Expected 3 foreign keys pointing to categories, found ${foreignKeys.length}`);

  const fkMap = new Map<string, any>(foreignKeys.map((fk: any) => [fk.table_name, fk]));
  assert.ok(fkMap.has('merchants'), 'Missing FK on merchants');
  assert.equal(fkMap.get('merchants').column_name, 'category_id');
  assert.equal(fkMap.get('merchants').foreign_table_name, 'categories');

  assert.ok(fkMap.has('merchant_applications'), 'Missing FK on merchant_applications');
  assert.equal(fkMap.get('merchant_applications').column_name, 'category_id');
  assert.equal(fkMap.get('merchant_applications').foreign_table_name, 'categories');

  assert.ok(fkMap.has('user_category_preferences'), 'Missing FK on user_category_preferences');
  assert.equal(fkMap.get('user_category_preferences').column_name, 'category_id');
  assert.equal(fkMap.get('user_category_preferences').foreign_table_name, 'categories');
  console.log('✔ Passed: All 3 foreign keys verified on merchants, merchant_applications, and user_category_preferences.');

  // 3. Test null compatibility on merchants and merchant_applications
  console.log('\nTest 3: Testing null category_id compatibility...');
  const testMerchantNull = await prisma.merchants.create({
    data: {
      tax_id: '9999999999001',
      shop_name: 'ร้านทดสอบหมวดหมู่ Null',
      category_id: null,
      latitude: 13.7563,
      longitude: 100.5018,
    },
  });
  assert.equal(testMerchantNull.category_id, null);

  const testAppNull = await prisma.merchantApplication.create({
    data: {
      tax_id: '9999999999002',
      shop_name: 'ใบสมัครทดสอบหมวดหมู่ Null',
      contact_name: 'นายทดสอบ หมวดหมู่',
      email: 'test-null-cat@example.com',
      phone: '0812345671',
      password_hash: 'hash123',
      business_type: 'INDIVIDUAL',
      address: '123 ถนนสุขุมวิท',
      category_id: null,
      latitude: 13.7563,
      longitude: 100.5018,
    },
  });
  assert.equal(testAppNull.category_id, null);
  console.log('✔ Passed: Null category_id safely accepted on merchants and merchant_applications.');

  // 4. Test valid canonical category assignment
  console.log('\nTest 4: Testing valid canonical category assignment...');
  const testMerchantValid = await prisma.merchants.create({
    data: {
      tax_id: '9999999999003',
      shop_name: 'ร้านข้าวมันไก่ ประตูน้ำ',
      category_id: 'FOOD',
      latitude: 13.7500,
      longitude: 100.5400,
    },
  });
  assert.equal(testMerchantValid.category_id, 'FOOD');

  const testAppValid = await prisma.merchantApplication.create({
    data: {
      tax_id: '9999999999004',
      shop_name: 'ร้านชา กาแฟ ชุมชน',
      contact_name: 'นางสาวทดสอบ กาแฟ',
      email: 'test-beverage@example.com',
      phone: '0812345672',
      password_hash: 'hash123',
      business_type: 'INDIVIDUAL',
      address: '456 ถนนพญาไท',
      category_id: 'BEVERAGE',
      latitude: 13.7500,
      longitude: 100.5400,
    },
  });
  assert.equal(testAppValid.category_id, 'BEVERAGE');

  const testUser = await prisma.user.create({
    data: {
      citizen_id_hash: 'test-hash-pref-001',
      full_name: 'นายสมชาย ผู้ชื่นชอบของหวาน',
      province_code: '10',
    },
  });

  const testPrefValid = await prisma.user_category_preferences.create({
    data: {
      user_id: testUser.user_id,
      category_id: 'BAKERY_DESSERT',
      preference_weight: 1.00,
    },
  });
  assert.equal(testPrefValid.category_id, 'BAKERY_DESSERT');
  console.log('✔ Passed: Valid canonical categories assigned and persisted across all 3 tables.');

  // 5. Test invalid category rejection (Foreign Key enforcement)
  console.log('\nTest 5: Testing rejection of non-canonical/invalid category IDs...');
  let merchantFkError = false;
  try {
    await prisma.merchants.create({
      data: {
        tax_id: '9999999999005',
        shop_name: 'ร้านผิดหมวดหมู่',
        category_id: 'INVALID_CATEGORY_ID',
        latitude: 13.7500,
        longitude: 100.5400,
      },
    });
  } catch (err: any) {
    merchantFkError = true;
    console.log('  → Correctly rejected on merchants:', err.code || err.message.slice(0, 80));
  }
  assert.ok(merchantFkError, 'merchants must reject non-canonical category_id');

  let appFkError = false;
  try {
    await prisma.merchantApplication.create({
      data: {
        tax_id: '9999999999006',
        shop_name: 'ใบสมัครผิดหมวดหมู่',
        contact_name: 'นายผิด หมวดหมู่',
        email: 'test-invalid-cat@example.com',
        phone: '0812345673',
        password_hash: 'hash123',
        business_type: 'INDIVIDUAL',
        address: '789 ถนนพระราม 9',
        category_id: 'NON_EXISTENT_CAT',
        latitude: 13.7500,
        longitude: 100.5400,
      },
    });
  } catch (err: any) {
    appFkError = true;
    console.log('  → Correctly rejected on merchant_applications:', err.code || err.message.slice(0, 80));
  }
  assert.ok(appFkError, 'merchant_applications must reject non-canonical category_id');

  let prefFkError = false;
  try {
    await prisma.user_category_preferences.create({
      data: {
        user_id: testUser.user_id,
        category_id: 'UNKNOWN_CAT',
        preference_weight: 1.00,
      },
    });
  } catch (err: any) {
    prefFkError = true;
    console.log('  → Correctly rejected on user_category_preferences:', err.code || err.message.slice(0, 80));
  }
  assert.ok(prefFkError, 'user_category_preferences must reject non-canonical category_id');
  console.log('✔ Passed: All 3 tables strictly reject non-existent categories via Foreign Key constraint.');

  // 6. Test RESTRICT on delete master category
  console.log('\nTest 6: Testing ON DELETE RESTRICT on master categories table...');
  let restrictError = false;
  try {
    await prisma.$queryRawUnsafe('DELETE FROM "categories" WHERE category_id = \'FOOD\';');
  } catch (err: any) {
    restrictError = true;
    console.log('  → Correctly rejected master category deletion when referenced:', err.message.slice(0, 80));
  }
  assert.ok(restrictError, 'Master category deletion must be blocked by RESTRICT constraint');
  console.log('✔ Passed: ON DELETE RESTRICT successfully protects master category data integrity.');

  // 7. Cleanup test records
  console.log('\nTest 7: Cleaning up test records from isolated test DB...');
  await prisma.user_category_preferences.deleteMany({ where: { user_id: testUser.user_id } });
  await prisma.user.delete({ where: { user_id: testUser.user_id } });
  await prisma.merchants.deleteMany({
    where: { tax_id: { in: ['9999999999001', '9999999999003'] } },
  });
  await prisma.merchantApplication.deleteMany({
    where: { tax_id: { in: ['9999999999002', '9999999999004'] } },
  });
  console.log('✔ Passed: Isolated test database cleaned successfully.');

  console.log('\n============================================================');
  console.log('ALL MASTER CATEGORIES MIGRATION TESTS PASSED SUCCESSFULLY! 🚀');
  console.log('============================================================\n');
}

runMasterCategoriesVerification()
  .catch((err) => {
    console.error('VERIFICATION_FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
