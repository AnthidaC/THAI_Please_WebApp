import { Prisma } from '@prisma/client';
import { hashPassword } from '../utils/bcrypt';
import { hashCitizenId } from '../utils/citizen-id';
import { HttpError } from '../utils/http-error';
import { prisma } from '../utils/prisma';
import { toBangkokDatabaseDate } from '../utils/bangkok-date';
import type { CitizenRegisterInput } from '../validations/auth.validation';

export interface RegisteredCitizenResult {
  id: string;
  email: string;
  name: string;
  role: 'USER';
  createdAt: string;
}

export const registerCitizen = async (
  input: CitizenRegisterInput,
  db = prisma,
): Promise<RegisteredCitizenResult> => {
  const normalizedEmail = input.email.trim().toLowerCase();
  const citizenIdHash = hashCitizenId(input.citizenId);

  try {
    return await db.$transaction(async (tx) => {
      // 1. ตรวจสอบเลขประจำตัวประชาชนซ้ำ
      const existingCitizen = await tx.user.findUnique({
        where: { citizen_id_hash: citizenIdHash },
        select: { user_id: true },
      });
      if (existingCitizen) {
        throw new HttpError(409, 'เลขประจำตัวประชาชนนี้ถูกลงทะเบียนแล้ว');
      }

      // 2. ตรวจสอบอีเมลซ้ำข้ามทุกประเภทบัญชีใน auth_identities
      const existingIdentity = await tx.auth_identities.findUnique({
        where: { email: normalizedEmail },
        select: { email: true },
      });
      if (existingIdentity) {
        throw new HttpError(409, 'อีเมลนี้ถูกใช้งานแล้วในระบบ');
      }

      // 3. สร้าง User ในตาราง users
      const user = await tx.user.create({
        data: {
          citizen_id_hash: citizenIdHash,
          full_name: input.fullName.trim(),
          province_code: input.provinceCode.trim(),
          is_registered_thai_plus: false,
        },
      });

      // 4. สร้างกระเป๋าเงินเริ่มต้นใน wallets
      const now = new Date();
      const activeCampaign = await tx.campaigns.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { created_at: 'desc' },
      });
      const hasActiveCampaign = Boolean(
        activeCampaign &&
        now >= new Date(activeCampaign.start_date) &&
        now <= new Date(activeCampaign.end_date),
      );

      await tx.wallets.create({
        data: {
          user_id: user.user_id,
          campaign_id: hasActiveCampaign && activeCampaign ? activeCampaign.campaign_id : null,
          balance: 2000.0,
          daily_quota_limit: hasActiveCampaign && activeCampaign ? activeCampaign.daily_quota_limit : 200.0,
          daily_quota_used: 0.0,
          total_quota_remaining: hasActiveCampaign && activeCampaign ? activeCampaign.total_quota_limit : 3000.0,
          eligibility_status: hasActiveCampaign ? 'ELIGIBLE' : 'INELIGIBLE',
          status: 'ACTIVE',
          last_quota_reset_date: toBangkokDatabaseDate(now),
        },
      });

      // 5. บันทึก password hash ใน citizen_credentials
      const passwordHash = await hashPassword(input.password);
      await tx.citizen_credentials.create({
        data: {
          user_id: user.user_id,
          password_hash: passwordHash,
        },
      });

      // 6. ผูกอีเมลใน auth_identities ด้วย account_type = CITIZEN_ACCOUNT
      await tx.auth_identities.create({
        data: {
          email: normalizedEmail,
          account_type: 'CITIZEN_ACCOUNT',
          account_id: user.user_id,
        },
      });

      return {
        id: user.user_id,
        email: normalizedEmail,
        name: user.full_name,
        role: 'USER',
        createdAt: user.created_at.toISOString(),
      };
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (target.includes('citizen_id_hash') || target.includes('uq_users_citizen_id_hash')) {
        throw new HttpError(409, 'เลขประจำตัวประชาชนนี้ถูกลงทะเบียนแล้ว');
      }
      if (target.includes('email') || target.includes('auth_identities_pkey') || target.includes('auth_identities')) {
        throw new HttpError(409, 'อีเมลนี้ถูกใช้งานแล้วในระบบ');
      }
      throw new HttpError(409, 'ข้อมูลการสมัครซ้ำกับในระบบ กรุณาตรวจสอบข้อมูล');
    }
    throw error;
  }
};

