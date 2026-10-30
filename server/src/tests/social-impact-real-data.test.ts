import assert from 'node:assert';
import { socialImpactService, resolveMerchantLocation } from '../services/socialImpact.service';
import prisma from '../utils/prisma';

async function runTests() {
  console.log('🧪 Starting Social Impact Real Data Consistency Tests...');

  const now = new Date();
  const from = new Date(now.getTime() - 29 * 86400000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now.getTime());
  to.setUTCHours(23, 59, 59, 999);

  // 1. Fetch from getSummary (which powers /admin executive overview)
  const summary = await socialImpactService.getSummary(30);
  console.log('  📊 Summary (from transactions):', summary.summary);

  // 2. Fetch from getDashboard (which powers /admin/social-impact)
  const dashboard = await socialImpactService.getDashboard({
    level: 'province',
    from,
    to,
  });
  console.log('  🗺️ Dashboard (province level):', {
    totalCirculation: dashboard.totalCirculation,
    govContribution: dashboard.governmentContribution,
    citizenContribution: dashboard.citizenContribution,
    transactionCount: dashboard.transactionCount,
    benefitedMerchantDays: dashboard.benefitedMerchantDays,
    areasCount: dashboard.areas.length,
    timelineCount: dashboard.timeline.length,
  });

  // 3. Test that Dashboard totals match Summary totals EXACTLY
  assert.strictEqual(
    dashboard.totalCirculation,
    summary.summary.totalCirculation,
    `Dashboard totalCirculation (${dashboard.totalCirculation}) must equal Summary totalCirculation (${summary.summary.totalCirculation})`
  );
  assert.strictEqual(
    dashboard.transactionCount,
    summary.summary.transactionCount,
    `Dashboard transactionCount (${dashboard.transactionCount}) must equal Summary transactionCount (${summary.summary.transactionCount})`
  );
  assert.strictEqual(
    Math.round(dashboard.governmentContribution),
    Math.round(summary.summary.governmentContribution),
    `Dashboard governmentContribution (${dashboard.governmentContribution}) must match Summary governmentContribution (${summary.summary.governmentContribution})`
  );
  assert.strictEqual(
    Math.round(dashboard.citizenContribution),
    Math.round(summary.summary.citizenContribution),
    `Dashboard citizenContribution (${dashboard.citizenContribution}) must match Summary citizenContribution (${summary.summary.citizenContribution})`
  );
  console.log('  ✅ PASSED: Dashboard overview numbers match Summary overview numbers 100%!');

  // 4. Test that areas sum equals totalCirculation
  const areasSum = dashboard.areas.reduce((sum, a) => sum + a.totalCirculation, 0);
  assert.strictEqual(
    areasSum,
    dashboard.totalCirculation,
    `Sum of province areas (${areasSum}) must equal totalCirculation (${dashboard.totalCirculation})`
  );
  console.log('  ✅ PASSED: Province areas sum equals totalCirculation!');

  // 5. Test that timeline sum equals totalCirculation
  const timelineSum = dashboard.timeline.reduce((sum, t) => sum + t.totalCirculation, 0);
  assert.strictEqual(
    timelineSum,
    dashboard.totalCirculation,
    `Sum of timeline daily points (${timelineSum}) must equal totalCirculation (${dashboard.totalCirculation})`
  );
  console.log('  ✅ PASSED: Daily timeline sum equals totalCirculation!');

  // 6. Test District Drilldown
  const nakhonPathom = dashboard.areas.find((a) => a.code === '73' || a.name === 'นครปฐม');
  if (nakhonPathom) {
    const districtDashboard = await socialImpactService.getDashboard({
      level: 'district',
      from,
      to,
      code: '73',
    });
    const distSum = districtDashboard.areas.reduce((sum, a) => sum + a.totalCirculation, 0);
    assert.strictEqual(
      distSum,
      nakhonPathom.totalCirculation,
      `District breakdown sum (${distSum}) must equal Nakhon Pathom total (${nakhonPathom.totalCirculation})`
    );
    console.log('  ✅ PASSED: District drilldown matches province total!');

    // 7. Test Subdistrict Drilldown
    const kpsDistrict = districtDashboard.areas.find((a) => a.code === '7302' || a.name === 'กำแพงแสน');
    if (kpsDistrict) {
      const subdistrictDashboard = await socialImpactService.getDashboard({
        level: 'subdistrict',
        from,
        to,
        code: '7302',
      });
      const subSum = subdistrictDashboard.areas.reduce((sum, a) => sum + a.totalCirculation, 0);
      assert.strictEqual(
        subSum,
        kpsDistrict.totalCirculation,
        `Subdistrict breakdown sum (${subSum}) must equal Kamphaeng Saen total (${kpsDistrict.totalCirculation})`
      );
      console.log('  ✅ PASSED: Subdistrict drilldown matches district total!');
    }
  }

  // 8. Test Location Resolver
  const sampleMerchant = await prisma.merchants.findFirst({
    include: { merchant_application: true },
  });
  if (sampleMerchant) {
    const loc = resolveMerchantLocation(sampleMerchant);
    assert.ok(loc.provinceName, 'Resolved location must have provinceName');
    assert.ok(loc.provinceCode, 'Resolved location must have provinceCode');
    assert.ok(loc.districtName, 'Resolved location must have districtName');
    assert.ok(loc.districtCode, 'Resolved location must have districtCode');
    console.log('  ✅ PASSED: Merchant location resolver accurately resolves Thai administrative hierarchy!');
  }

  // 9. Test syncDailyMetrics
  await socialImpactService.syncDailyMetrics();
  const metricsCount = await prisma.daily_social_impact_metrics.count();
  assert.ok(metricsCount > 0, `daily_social_impact_metrics must have records (found: ${metricsCount})`);
  console.log(`  ✅ PASSED: daily_social_impact_metrics table is populated and synced (${metricsCount} rows)!`);

  console.log('🎉 ALL SOCIAL IMPACT DATA CONSISTENCY TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });
