import prisma from '../utils/prisma';

async function main() {
  const user = await prisma.user.findFirst();
  console.log('User:', user?.user_id);
  if (!user) return;

  let merchant = await prisma.merchants.findFirst();
  if (!merchant) {
    merchant = await prisma.merchants.create({
      data: {
        tax_id: '0105562098741',
        shop_name: 'ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)',
        latitude: 13.7500,
        longitude: 100.5000,
        average_rating_stars: 4.9,
        is_approved: true,
      },
    });
  }
  console.log('Merchant:', merchant.merchant_id);

  const tx1 = await prisma.transactions.create({
    data: {
      qr_reference: 'TP-QR-DEMO-001',
      user_id: user.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: 150.0,
      government_copay_amount: 90.0,
      citizen_paid_amount: 60.0,
      status: 'SUCCESS',
      completed_at: new Date(Date.now() - 3600000),
    },
  });
  console.log('Created tx1:', tx1.transaction_id);

  const tx2 = await prisma.transactions.create({
    data: {
      qr_reference: 'TP-QR-SUSP-002',
      user_id: user.user_id,
      merchant_id: merchant.merchant_id,
      total_amount: 250.0,
      government_copay_amount: 150.0,
      citizen_paid_amount: 100.0,
      status: 'SUCCESS',
      completed_at: new Date(Date.now() - 600000),
    },
  });

  console.log('Created tx2:', tx2.transaction_id);

  const fc = await prisma.fraud_checks.create({
    data: {
      transaction_id: tx2.transaction_id,
      user_latitude: 13.7655,
      user_longitude: 100.5015,
      merchant_latitude: Number(merchant.latitude),
      merchant_longitude: Number(merchant.longitude),
      distance_meters: 1720.0,
      is_distance_valid: true,
      risk_score: 0.78,
      fraud_reason:
        'AI ตรวจพบความถี่ผิดปกติ: สแกนร้านเดิมซ้ำ 3 ครั้งใน 1 วัน ร่วมกับพิกัดใกล้ขอบเขต 2 กม. (ห่าง 1.72 กม.)',
      decision: 'FLAGGED_FOR_REVIEW',
    },
  });
  console.log('Created fraud check:', fc.fraud_check_id);

  const wallet = await prisma.wallets.findUnique({ where: { user_id: user.user_id } });
  if (wallet) {
    await prisma.wallet_transactions.createMany({
      data: [
        {
          wallet_id: wallet.wallet_id,
          transaction_type: 'TOPUP',
          amount: 500.0,
          payment_channel: 'PROMPTPAY',
          reference_number: 'TOPUP-20261017-001',
          balance_after: 2000.0,
        },
        {
          wallet_id: wallet.wallet_id,
          transaction_id: tx1.transaction_id,
          transaction_type: 'COPAY_PAYMENT',
          amount: 60.0,
          payment_channel: 'COPAY_WALLET',
          reference_number: 'TP-QR-DEMO-001',
          balance_after: 1940.0,
        },
      ],
    });
    console.log('Created wallet transactions');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
