import prisma from '../utils/prisma';

export interface MonthlyCycleInfo {
  currentMonthName: string;
  validUntilDate: string;
  nextQuotaDate: string;
  cumulativeToMonthLabel: string;
  monthlyAllocationAmount: number;
}

export interface AvailableCampaignInfo {
  campaignId: string;
  campaignName: string;
  governmentCopayRatePercent: number;
  citizenPaymentRatePercent: number;
  dailyQuotaLimit: number;
  totalQuotaLimit: number;
  startDate: string;
  endDate: string;
  status: string;
  isRegistrationOpen: boolean;
}

export interface WalletDetails {
  walletId: string;
  userId: string;
  balance: number;
  dailyQuotaLimit: number;
  dailyQuotaUsed: number;
  dailyQuotaRemaining: number;
  totalQuotaRemaining: number;
  eligibilityStatus: string; // 'ELIGIBLE' | 'INELIGIBLE' | 'SUSPENDED' | 'CAMPAIGN_EXPIRED'
  status: string;
  lastQuotaResetDate: string;
  monthlyCycle: MonthlyCycleInfo;
  campaignInfo?: {
    campaignId: string;
    campaignName: string;
    startDate: string;
    endDate: string;
    dailyLimit: number;
    totalLimit: number;
    isStarted: boolean;
    isExpired: boolean;
    isActive: boolean;
  } | null;
  availableCampaignForRegistration?: AvailableCampaignInfo | null;
}

export const getMonthlyCycleDetails = (
  now = new Date(),
  campaignEndDate?: Date
): MonthlyCycleInfo => {
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];
  const thaiShortMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  const currentMonthIdx = now.getMonth();
  const currentYearBuddhist = now.getFullYear() + 543;
  const currentMonthName = `${thaiMonths[currentMonthIdx]} ${currentYearBuddhist}`;

  // หากมีวันสิ้นสุดโครงการ และสิ้นสุดก่อนวันสิ้นเดือน ให้ใช้วันสิ้นสุดโครงการ
  const lastDayOfMonth = new Date(now.getFullYear(), currentMonthIdx + 1, 0);
  let effectiveEndDate = lastDayOfMonth;
  if (campaignEndDate && campaignEndDate < lastDayOfMonth && campaignEndDate >= now) {
    effectiveEndDate = campaignEndDate;
  }

  const validUntilDate = `${effectiveEndDate.getDate()} ${thaiMonths[effectiveEndDate.getMonth()]} ${effectiveEndDate.getFullYear() + 543}`;

  const nextMonthIdx = (currentMonthIdx + 1) % 12;
  const nextMonthYear = currentMonthIdx === 11 ? currentYearBuddhist + 1 : currentYearBuddhist;
  const nextQuotaDate = `1 ${thaiShortMonths[nextMonthIdx]} ${nextMonthYear}`;

  return {
    currentMonthName,
    validUntilDate,
    nextQuotaDate,
    cumulativeToMonthLabel: `ใช้ได้ถึงวันที่ ${validUntilDate}`,
    monthlyAllocationAmount: 1000.0, // เดือนละ 1,000 บาท
  };
};

export class WalletService {
  /**
   * ดึงข้อมูลกระเป๋าเงินของผู้ใช้ พร้อมตรวจสอบสิทธิ์โครงการและวันเริ่มต้น-สิ้นสุดจาก DB
   */
  public async getWalletByUserId(userId: string): Promise<WalletDetails> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // ดึงโครงการ Co-pay ที่เปิดใช้งานล่าสุดในระบบจาก DB
    const activeCampaign = await prisma.campaigns.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { created_at: 'desc' },
    });

    let wallet = await prisma.wallets.findUnique({
      where: { user_id: userId },
      include: { campaigns: true },
    });

    // หากยังไม่มีกระเป๋าเงิน ให้สร้างกระเป๋าเงินเริ่มต้น
    if (!wallet) {
      const hasActiveCampaign =
        activeCampaign &&
        now >= new Date(activeCampaign.start_date) &&
        now <= new Date(activeCampaign.end_date);

      wallet = await prisma.wallets.create({
        data: {
          user_id: userId,
          campaign_id: hasActiveCampaign ? activeCampaign.campaign_id : null,
          balance: 2000.0, // วงเงินส่วนตัวเริ่มต้น 2,000 บาท
          daily_quota_limit: hasActiveCampaign ? activeCampaign.daily_quota_limit : 200.0,
          daily_quota_used: 0.0,
          total_quota_remaining: hasActiveCampaign ? activeCampaign.total_quota_limit : 3000.0,
          eligibility_status: hasActiveCampaign ? 'ELIGIBLE' : 'INELIGIBLE',
          status: 'ACTIVE',
          last_quota_reset_date: new Date(),
        },
        include: { campaigns: true },
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
          include: { campaigns: true },
        });
      }
    }

    // -------------------------------------------------------------------------
    // ตรวจสอบสิทธิ์โครงการตามวันเริ่มต้น-สิ้นสุด และสถานะจาก DB
    // -------------------------------------------------------------------------
    let effectiveEligibility = wallet.eligibility_status;
    let campaignInfo: WalletDetails['campaignInfo'] = null;
    let availableCampaignForRegistration: AvailableCampaignInfo | null = null;
    let effectiveDailyLimit = Number(wallet.daily_quota_limit) || 200.0;
    let campaignEndDate: Date | undefined;

    const linkedCampaign = wallet.campaigns;

    if (linkedCampaign) {
      campaignEndDate = new Date(linkedCampaign.end_date);
      const isStarted = now >= new Date(linkedCampaign.start_date);
      const isExpired = now > campaignEndDate;
      const isActive = linkedCampaign.status === 'ACTIVE' && isStarted && !isExpired;

      campaignInfo = {
        campaignId: linkedCampaign.campaign_id,
        campaignName: linkedCampaign.campaign_name,
        startDate: linkedCampaign.start_date.toISOString(),
        endDate: linkedCampaign.end_date.toISOString(),
        dailyLimit: Number(linkedCampaign.daily_quota_limit),
        totalLimit: Number(linkedCampaign.total_quota_limit),
        isStarted,
        isExpired,
        isActive,
      };

      // ซิงค์เพดานรายวันจาก DB (เช่น 200 บ./วัน)
      effectiveDailyLimit = Number(linkedCampaign.daily_quota_limit);

      if (isExpired) {
        effectiveEligibility = 'CAMPAIGN_EXPIRED';
      } else if (!isStarted || linkedCampaign.status !== 'ACTIVE') {
        effectiveEligibility = 'INELIGIBLE';
      }
    } else {
      // ผู้ใช้ยังไม่มีสิทธิ หรือยังไม่ได้ผูกกับโครงการใด
      effectiveEligibility = 'INELIGIBLE';
    }

    // หากผู้ใช้ยัง "ไม่มีสิทธิรับ" ให้ตรวจสอบว่าระบบมีโครงการที่เปิดรับสมัครอยู่หรือไม่
    if (effectiveEligibility === 'INELIGIBLE' || effectiveEligibility === 'CAMPAIGN_EXPIRED') {
      if (activeCampaign) {
        const isStarted = now >= new Date(activeCampaign.start_date);
        const isExpired = now > new Date(activeCampaign.end_date);
        const isRegistrationOpen = activeCampaign.status === 'ACTIVE' && isStarted && !isExpired;

        availableCampaignForRegistration = {
          campaignId: activeCampaign.campaign_id,
          campaignName: activeCampaign.campaign_name,
          governmentCopayRatePercent: Number(activeCampaign.government_copay_rate_percent),
          citizenPaymentRatePercent: Number(activeCampaign.citizen_payment_rate_percent),
          dailyQuotaLimit: Number(activeCampaign.daily_quota_limit),
          totalQuotaLimit: Number(activeCampaign.total_quota_limit),
          startDate: activeCampaign.start_date.toISOString(),
          endDate: activeCampaign.end_date.toISOString(),
          status: activeCampaign.status,
          isRegistrationOpen,
        };
      }
    }

    const dailyUsed = Number(wallet.daily_quota_used);
    const dailyRemaining =
      effectiveEligibility === 'ELIGIBLE'
        ? Math.max(0, Math.round((effectiveDailyLimit - dailyUsed) * 100) / 100)
        : 0;

    return {
      walletId: wallet.wallet_id,
      userId: wallet.user_id,
      balance: Number(wallet.balance),
      dailyQuotaLimit: effectiveDailyLimit,
      dailyQuotaUsed: dailyUsed,
      dailyQuotaRemaining: dailyRemaining,
      totalQuotaRemaining:
        effectiveEligibility === 'ELIGIBLE' ? Number(wallet.total_quota_remaining) : 0,
      eligibilityStatus: effectiveEligibility,
      status: wallet.status,
      lastQuotaResetDate: wallet.last_quota_reset_date.toISOString(),
      monthlyCycle: getMonthlyCycleDetails(now, campaignEndDate),
      campaignInfo,
      availableCampaignForRegistration,
    };
  }

  /**
   * ประชาชนลงทะเบียนขอรับสิทธิ์โครงการ Co-pay ที่เปิดรับสมัครใน DB
   */
  public async enrollInCampaign(userId: string, campaignId?: string) {
    const now = new Date();
    const campaign = campaignId
      ? await prisma.campaigns.findUnique({ where: { campaign_id: campaignId } })
      : await prisma.campaigns.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { created_at: 'desc' },
        });

    if (!campaign) {
      throw new Error('ไม่พบโครงการ Co-pay ที่เปิดรับสมัครในขณะนี้');
    }
    if (campaign.status !== 'ACTIVE') {
      throw new Error('โครงการนี้ไม่ได้เปิดใช้งานหรือถูกระงับชั่วคราว');
    }
    if (now < new Date(campaign.start_date)) {
      throw new Error(
        `โครงการยังไม่เปิดรับสมัคร (เปิดรับสมัครวันที่ ${new Date(campaign.start_date).toLocaleDateString('th-TH')})`
      );
    }
    if (now > new Date(campaign.end_date)) {
      throw new Error('โครงการสิ้นสุดระยะเวลาการรับสมัครและดำเนินโครงการแล้ว');
    }

    let wallet = await prisma.wallets.findUnique({ where: { user_id: userId } });
    if (!wallet) {
      await this.getWalletByUserId(userId);
      wallet = await prisma.wallets.findUnique({ where: { user_id: userId } });
    }

    if (!wallet) {
      throw new Error('ไม่พบข้อมูลกระเป๋าเงินของผู้ใช้');
    }

    const updatedWallet = await prisma.wallets.update({
      where: { wallet_id: wallet.wallet_id },
      data: {
        campaign_id: campaign.campaign_id,
        eligibility_status: 'ELIGIBLE',
        daily_quota_limit: campaign.daily_quota_limit,
        total_quota_remaining: campaign.total_quota_limit,
      },
    });

    return {
      success: true,
      message: `ลงทะเบียนรับสิทธิ์ ${campaign.campaign_name} สำเร็จเรียบร้อยแล้ว`,
      campaignName: campaign.campaign_name,
      dailyQuotaLimit: Number(campaign.daily_quota_limit),
      totalQuotaLimit: Number(campaign.total_quota_limit),
      startDate: campaign.start_date,
      endDate: campaign.end_date,
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
