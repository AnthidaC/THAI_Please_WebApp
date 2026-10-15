import prisma from '../utils/prisma';

export interface WalletDetails {
  walletId: string;
  userId: string;
  balance: number;
  dailyQuotaLimit: number;
  dailyQuotaUsed: number;
  dailyQuotaRemaining: number;
  totalQuotaRemaining: number;
  eligibilityStatus: string;
  status: string;
  lastQuotaResetDate: string;
}

export class WalletService {
  /**
   * ดึงข้อมูลกระเป๋าเงินของผู้ใช้ พร้อมตรวจสอบการรีเซ็ตโควตารายวันอัตโนมัติ
   */
  public async getWalletByUserId(userId: string): Promise<WalletDetails> {
    let wallet = await prisma.wallets.findUnique({
      where: { user_id: userId },
    });

    const todayStr = new Date().toISOString().split('T')[0];

    // หากยังไม่มีกระเป๋าเงิน ให้สร้างกระเป๋าเงินเริ่มต้นสำหรับทดสอบทันที
    if (!wallet) {
      wallet = await prisma.wallets.create({
        data: {
          user_id: userId,
          balance: 2000.0, // วงเงินส่วนตัวเริ่มต้น 2,000 บาท
          daily_quota_limit: 150.0, // วงเงินรัฐสมทบ 150 บาท/วัน
          daily_quota_used: 0.0,
          total_quota_remaining: 3000.0, // สิทธิรวมทั้งโครงการ 3,000 บาท
          eligibility_status: 'ELIGIBLE',
          status: 'ACTIVE',
          last_quota_reset_date: new Date(),
        },
      });
    } else {
      // ตรวจสอบการข้ามวันเพื่อรีเซ็ต daily_quota_used
      const lastResetStr = new Date(wallet.last_quota_reset_date).toISOString().split('T')[0];
      if (lastResetStr !== todayStr) {
        wallet = await prisma.wallets.update({
          where: { wallet_id: wallet.wallet_id },
          data: {
            daily_quota_used: 0.0,
            last_quota_reset_date: new Date(),
          },
        });
      }
    }

    const dailyLimit = Number(wallet.daily_quota_limit);
    const dailyUsed = Number(wallet.daily_quota_used);
    const dailyRemaining = Math.max(0, Math.round((dailyLimit - dailyUsed) * 100) / 100);

    return {
      walletId: wallet.wallet_id,
      userId: wallet.user_id,
      balance: Number(wallet.balance),
      dailyQuotaLimit: dailyLimit,
      dailyQuotaUsed: dailyUsed,
      dailyQuotaRemaining: dailyRemaining,
      totalQuotaRemaining: Number(wallet.total_quota_remaining),
      eligibilityStatus: wallet.eligibility_status,
      status: wallet.status,
      lastQuotaResetDate: wallet.last_quota_reset_date.toISOString(),
    };
  }

  /**
   * เติมเงินเข้ากระเป๋าเงินดิจิทัลส่วนตัว
   */
  public async topUp(
    userId: string,
    amount: number,
    paymentChannel = 'PROMPTPAY'
  ): Promise<{ newBalance: number; transactionId: string }> {
    if (amount <= 0) {
      throw new Error('จำนวนเงินที่ต้องการเติมต้องมากกว่า 0 บาท');
    }

    const currentWallet = await this.getWalletByUserId(userId);
    const newBalance = Math.round((currentWallet.balance + amount) * 100) / 100;
    const refNumber = `TOPUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedWallet = await tx.wallets.update({
        where: { wallet_id: currentWallet.walletId },
        data: {
          balance: newBalance,
        },
      });

      const walletTx = await tx.wallet_transactions.create({
        data: {
          wallet_id: currentWallet.walletId,
          transaction_type: 'TOPUP',
          amount,
          payment_channel: paymentChannel,
          reference_number: refNumber,
          balance_after: newBalance,
        },
      });

      return {
        newBalance: Number(updatedWallet.balance),
        transactionId: walletTx.wallet_transaction_id,
      };
    });

    return result;
  }
}

export const walletService = new WalletService();
