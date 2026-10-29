import { randomBytes } from 'node:crypto';
import { comparePassword, hashPassword } from '../utils/bcrypt';
import { HttpError } from '../utils/http-error';
import { signToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';

export interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  merchantApprovalStatus?: 'APPROVED';
  merchantApplicationSubmittedAt?: string;
  merchantRejectionReason?: string | null;
}

export type CredentialLoginOutcome =
  | { kind: 'authenticated'; data: { user: LoginUser; token: string } }
  | { kind: 'application-status'; applicationStatus: 'PENDING' | 'REJECTED'; token: string };

export interface CredentialCandidate {
  passwordHash: string;
  authenticate: () => Promise<CredentialLoginOutcome>;
}

export type CredentialProvider = (email: string) => Promise<CredentialCandidate | null>;
export type PasswordVerifier = (password: string, passwordHash: string) => Promise<boolean>;
export type DummyHashProvider = () => Promise<string>;

export const INVALID_CREDENTIALS_MESSAGE = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
export const ACCOUNT_COLLISION_MESSAGE = 'พบข้อมูลบัญชีซ้ำ กรุณาติดต่อผู้ดูแลระบบ';

export const createCredentialLoginService = (
  providers: readonly CredentialProvider[],
  verifyPassword: PasswordVerifier,
  getDummyHash: DummyHashProvider,
) => async (email: string, password: string): Promise<CredentialLoginOutcome> => {
  const candidates = await Promise.all(providers.map((provider) => provider(email)));
  const dummyHash = await getDummyHash();
  const verificationResults = await Promise.all(candidates.map((candidate) =>
    verifyPassword(password, candidate?.passwordHash ?? dummyHash)
  ));
  const matches: CredentialCandidate[] = [];
  candidates.forEach((candidate, index) => {
    if (candidate && verificationResults[index]) matches.push(candidate);
  });

  if (matches.length > 1) throw new HttpError(409, ACCOUNT_COLLISION_MESSAGE);
  if (matches.length === 0) throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
  return matches[0].authenticate();
};

let dummyHashPromise: Promise<string> | undefined;
const getDummyHash = (): Promise<string> => {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyHashPromise;
};

const findMerchantCredential: CredentialProvider = async (email) => {
  const application = await prisma.merchantApplication.findFirst({
    where: { email },
    orderBy: { created_at: 'desc' },
    include: { merchant: true },
  });
  if (!application) return null;

  return {
    passwordHash: application.password_hash,
    authenticate: async () => {
      if (application.status === 'PENDING') {
        return { kind: 'application-status', applicationStatus: 'PENDING', token: signToken({ userId: application.application_id, role: 'MERCHANT_APPLICATION_STATUS', tokenScope: 'MERCHANT_APPLICATION_STATUS' }) };
      }
      if (application.status === 'REJECTED') {
        return { kind: 'application-status', applicationStatus: 'REJECTED', token: signToken({ userId: application.application_id, role: 'MERCHANT_APPLICATION_STATUS', tokenScope: 'MERCHANT_APPLICATION_STATUS' }) };
      }
      if (application.status !== 'APPROVED' || !application.merchant?.is_approved) {
        throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
      }

      const merchant = application.merchant;
      return {
        kind: 'authenticated',
        data: {
          user: {
            id: merchant.merchant_id,
            email: application.email,
            name: merchant.shop_name,
            role: 'MERCHANT',
            createdAt: merchant.created_at.toISOString(),
            merchantApprovalStatus: 'APPROVED',
            merchantApplicationSubmittedAt: application.created_at.toISOString(),
            merchantRejectionReason: application.rejection_reason,
          },
          token: signToken({ userId: merchant.merchant_id, role: 'MERCHANT' }),
        },
      };
    },
  };
};

const findStaffCredential: CredentialProvider = async (email) => {
  const staff = await prisma.staff_accounts.findUnique({ where: { email } });
  if (!staff) return null;

  return {
    passwordHash: staff.password_hash,
    authenticate: async () => {
      if (!staff.is_active) throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
      return {
        kind: 'authenticated',
        data: {
          user: {
            id: staff.staff_id,
            email: staff.email,
            name: staff.full_name,
            role: staff.role,
            createdAt: staff.created_at.toISOString(),
          },
          token: signToken({ userId: staff.staff_id, role: staff.role }),
        },
      };
    },
  };
};

export const loginWithCredentials = createCredentialLoginService(
  [findMerchantCredential, findStaffCredential],
  comparePassword,
  getDummyHash,
);
