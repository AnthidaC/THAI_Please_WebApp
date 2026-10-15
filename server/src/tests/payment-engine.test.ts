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
  const distSame = calculateHaversineDistance(13.7563, 100.5018, 13.7563, 100.5018);
  assert.strictEqual(distSame, 0);

  const distNear = calculateHaversineDistance(13.7525, 100.5014, 13.7567, 100.5018);
  assert.ok(distNear >= 400 && distNear <= 600, `ระยะทางควรอยู่ที่ประมาณ 460-480 เมตร ได้ ${distNear}`);
  console.log(`  ✅ ผ่าน: คำนวณระยะพิกัด GPS Haversine สำเร็จ (${distNear} เมตร)`);

  const distFar = calculateHaversineDistance(13.7563, 100.5018, 18.7883, 98.9853);
  assert.ok(distFar > 550000, `ระยะทางกรุงเทพ-เชียงใหม่ควรมากกว่า 550 กม. ได้ ${distFar}`);
  console.log(`  ✅ ผ่าน: คำนวณระยะพิกัด GPS ระยะไกลข้ามจังหวัด (${Math.round(distFar / 1000)} กม.)`);
}

// 5. ทดสอบคำนวณ Co-pay 60/40 ร่วมกับคูปองส่วนลด 30 บาท (ยอดรวม 200 บ. - คูปอง 30 บ. = ยอดสุทธิ 170 บ.)
{
  const result = paymentService.calculateCopay(200, 150, 3000, 30, 'COUPON30', 'คูปองส่วนลด ฿30');
  assert.strictEqual(result.originalTotalAmount, 200);
  assert.strictEqual(result.discountAmount, 30);
  assert.strictEqual(result.netTotalAmount, 170); // 200 - 30 = 170
  assert.strictEqual(result.governmentCopayAmount, 102); // 60% ของ 170 คือ 102
  assert.strictEqual(result.citizenPaidAmount, 68); // 40% ของ 170 คือ 68
  assert.strictEqual(result.totalSavingsAmount, 132); // รัฐช่วย 102 + คูปอง 30 = ประหยัด 132 บาท!
  assert.strictEqual(result.dailyQuotaRemainingAfter, 48); // 150 - 102 = 48
  console.log('  ✅ ผ่าน: คำนวณ Co-pay 60/40 ร่วมกับคูปองส่วนลด (ยอด 200 -> ลด 30 -> รัฐ 102 / ประชาชน 68)');
}

// 6. ทดสอบคำนวณ Co-pay 60/40 ร่วมกับโค้ดคำชวนของเพื่อน (Friend Referral Code เช่น FRIEND30)
{
  const result = paymentService.calculateCopay(100, 150, 3000, 30, 'FRIEND30', 'โค้ดคำชวนของเพื่อน (สมชาย)');
  assert.strictEqual(result.originalTotalAmount, 100);
  assert.strictEqual(result.discountAmount, 30);
  assert.strictEqual(result.netTotalAmount, 70); // 100 - 30 = 70
  assert.strictEqual(result.governmentCopayAmount, 42); // 60% ของ 70 คือ 42
  assert.strictEqual(result.citizenPaidAmount, 28); // 40% ของ 70 คือ 28
  assert.strictEqual(result.totalSavingsAmount, 72); // ประหยัด 72 บาท
  console.log('  ✅ ผ่าน: คำนวณ Co-pay 60/40 ร่วมกับโค้ดคำชวนของเพื่อน (ยอด 100 -> ลด 30 -> รัฐ 42 / ประชาชน 28)');
}

// 7. ทดสอบตรวจสอบความถูกต้องของรหัสส่วนลด / โค้ดชวนเพื่อน (validateDiscountCode)
async function testDiscountValidation() {
  // ทดสอบโค้ดชวนเพื่อน FRIEND30
  const referralCheck = await paymentService.validateDiscountCode({
    code: 'FRIEND30',
    totalAmount: 150,
  });
  assert.strictEqual(referralCheck.isValid, true);
  assert.strictEqual(referralCheck.discountAmount, 30);
  assert.strictEqual(referralCheck.discountSource, 'FRIEND_REFERRAL');
  console.log(`  ✅ ผ่าน: ตรวจสอบโค้ดคำชวนของเพื่อนสำเร็จ: ${referralCheck.sourceDescription}`);

  // ทดสอบคูปอง DUO50
  const couponCheck = await paymentService.validateDiscountCode({
    code: 'DUO50',
    totalAmount: 200,
  });
  assert.strictEqual(couponCheck.isValid, true);
  assert.strictEqual(couponCheck.discountAmount, 50);
  console.log(`  ✅ ผ่าน: ตรวจสอบคูปองส่วนลดสำเร็จ: ${couponCheck.sourceDescription}`);

  // ทดสอบโค้ดไม่ถูกต้อง (ต้องโยน Error)
  await assert.rejects(
    async () => {
      await paymentService.validateDiscountCode({
        code: 'INVALID_CODE_999',
        totalAmount: 100,
      });
    },
    /ไม่พบรหัสคูปองหรือโค้ดคำชวนของเพื่อน/,
    'ควรแสดงข้อผิดพลาดเมื่อโค้ดไม่ถูกต้อง'
  );
  console.log('  ✅ ผ่าน: ปฏิเสธโค้ดส่วนลดที่ไม่ถูกต้องตามมาตรฐาน');
}

// 8. ทดสอบ Semi-AI Anomaly Evaluator
async function testAiEngine() {
  const aiEngine = AiFraudEngine.getInstance();

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

  console.log('\n🎉 ผลการทดสอบ Unit Tests ทั้งหมด 8/8 ผ่านอย่างสมบูรณ์แบบ!');
}

async function runAllTests() {
  await testDiscountValidation();
  await testAiEngine();
}

runAllTests().catch((err) => {
  console.error('❌ การทดสอบล้มเหลว:', err);
  process.exit(1);
});
