import assert from 'node:assert';
import { paymentService } from '../services/payment.service';
import { calculateHaversineDistance, AiFraudEngine } from '../services/fraud.service';

console.log('🧪 เริ่มการทดสอบระบบคำนวณและประมวลผล (Unit Tests: Payment & Fraud Engine)');

// 1. ทดสอบการคำนวณ Co-pay 60/40 ปกติ (ยอด 200 บาท, โควตาเหลือเต็ม 150 บาท)
{
  const result = paymentService.calculateCopay(200, 150, 3000);
  assert.strictEqual(result.totalAmount, 200);
  assert.strictEqual(result.governmentCopayAmount, 120); // 60% ของ 200 คือ 120 ไม่เกิน 150
  assert.strictEqual(result.citizenPaidAmount, 80); // 40% ของ 200 คือ 80
  assert.strictEqual(result.dailyQuotaRemainingAfter, 30); // 150 - 120 = 30
  console.log('  ✅ ผ่าน: คำนวณ Co-pay 60/40 กรณีปกติ ยอด 200 บาท (รัฐ 120 / ประชาชน 80)');
}

// 2. ทดสอบกรณีค่าสินค้าสูงเกินเพดาน 150 บาทต่อวัน (ยอด 500 บาท, โควตาวันละ 150 บาท)
{
  const result = paymentService.calculateCopay(500, 150, 3000);
  assert.strictEqual(result.totalAmount, 500);
  assert.strictEqual(result.governmentCopayAmount, 150); // โควตารายวันจำกัดที่ 150
  assert.strictEqual(result.citizenPaidAmount, 350); // ประชาชนจ่าย 350
  assert.strictEqual(result.dailyQuotaRemainingAfter, 0); // โควตารายวันหมด
  console.log('  ✅ ผ่าน: คำนวณ Co-pay กรณีติดเพดานโควตารายวัน 150 บาท (ยอด 500 -> รัฐ 150 / ประชาชน 350)');
}

// 3. ทดสอบกรณีโควตารายวันเหลือ 40 บาท (ยอด 100 บาท)
{
  const result = paymentService.calculateCopay(100, 40, 3000);
  assert.strictEqual(result.totalAmount, 100);
  assert.strictEqual(result.governmentCopayAmount, 40); // ช่วยได้ตามโควตาที่เหลือ
  assert.strictEqual(result.citizenPaidAmount, 60); // ประชาชนจ่าย 60
  assert.strictEqual(result.dailyQuotaRemainingAfter, 0);
  console.log('  ✅ ผ่าน: คำนวณ Co-pay เมื่อโควตารายวันเหลือน้อยกว่า 60% (รัฐ 40 / ประชาชน 60)');
}

// 4. ทดสอบระยะทาง Haversine Formula (พิกัดเดียวกัน vs ต่างพิกัด)
{
  // จุดเดียวกัน ระยะห่างต้องเป็น 0
  const distSame = calculateHaversineDistance(13.7563, 100.5018, 13.7563, 100.5018);
  assert.strictEqual(distSame, 0);

  // เสาชิงช้า (13.7525, 100.5014) ไป อนุสาวรีย์ประชาธิปไตย (13.7567, 100.5018) ห่างประมาณ 460-480 เมตร
  const distNear = calculateHaversineDistance(13.7525, 100.5014, 13.7567, 100.5018);
  assert.ok(distNear >= 400 && distNear <= 600, `ระยะทางควรอยู่ที่ประมาณ 460-480 เมตร ได้ ${distNear}`);
  console.log(`  ✅ ผ่าน: คำนวณระยะพิกัด GPS Haversine สำเร็จ (${distNear} เมตร)`);

  // กรุงเทพฯ (13.7563, 100.5018) ไป เชียงใหม่ (18.7883, 98.9853) ห่างประมาณ 580-600 กิโลเมตร
  const distFar = calculateHaversineDistance(13.7563, 100.5018, 18.7883, 98.9853);
  assert.ok(distFar > 550000, `ระยะทางกรุงเทพ-เชียงใหม่ควรมากกว่า 550 กม. ได้ ${distFar}`);
  console.log(`  ✅ ผ่าน: คำนวณระยะพิกัด GPS ระยะไกลข้ามจังหวัด (${Math.round(distFar / 1000)} กม.)`);
}

// 5. ทดสอบ Semi-AI Anomaly Evaluator
async function testAiEngine() {
  const aiEngine = AiFraudEngine.getInstance();

  // กรณีปกติ: อยู่หน้าร้าน 50 เมตร, จ่าย 120 บาท
  const normalAssessment = await aiEngine.evaluate({
    userId: 'u-1',
    merchantId: 'm-1',
    amount: 120,
    userLat: 13.7525,
    userLon: 100.5014,
    merchantLat: 13.7528,
    merchantLon: 100.5016,
    distanceMeters: 40,
    recentTxCountIn10Min: 1,
    estimatedSpeedKmH: 0,
    timeHour: 12,
  });
  assert.strictEqual(normalAssessment.decision, 'AUTO_APPROVED');
  assert.ok(normalAssessment.riskScore < 0.3, `คะแนนความเสี่ยงกรณีปกติควรต่ำ ได้ ${normalAssessment.riskScore}`);
  console.log(`  ✅ ผ่าน: Semi-AI ประเมินธุรกรรมปกติ -> AUTO_APPROVED (Risk: ${normalAssessment.riskScore})`);

  // กรณีผิดปกติ: ห่างจากร้านค้า 6,000 เมตร (6 กม.)
  const suspiciousAssessment = await aiEngine.evaluate({
    userId: 'u-2',
    merchantId: 'm-1',
    amount: 1500,
    userLat: 13.7525,
    userLon: 100.5014,
    merchantLat: 13.8000,
    merchantLon: 100.5500,
    distanceMeters: 6200,
    recentTxCountIn10Min: 3,
    estimatedSpeedKmH: 45,
    timeHour: 2,
  });
  assert.ok(suspiciousAssessment.decision === 'FLAGGED_FOR_REVIEW' || suspiciousAssessment.decision === 'REJECTED');
  assert.ok(suspiciousAssessment.riskScore >= 0.5, `คะแนนความเสี่ยงกรณีผิดปกติควรสูง ได้ ${suspiciousAssessment.riskScore}`);
  console.log(`  ✅ ผ่าน: Semi-AI ประเมินธุรกรรมห่างไกล -> ${suspiciousAssessment.decision} (Risk: ${suspiciousAssessment.riskScore})`);

  console.log('\n🎉 ผลการทดสอบ Unit Tests ทั้งหมด 5/5 ผ่านอย่างสมบูรณ์แบบ!');
}

testAiEngine().catch((err) => {
  console.error('❌ การทดสอบล้มเหลว:', err);
  process.exit(1);
});
