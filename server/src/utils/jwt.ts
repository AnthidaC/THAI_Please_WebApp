import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  role: string;
  /** Restricts an unapproved merchant session to its own application status endpoint. */
  tokenScope?: string;
  /** Issued-at (seconds), set by jsonwebtoken. */
  iat?: number;
  /** Marks a mock account session. */
  isDemo?: boolean;
}

export const isRestrictedToken = (payload: TokenPayload): boolean =>
  payload.tokenScope !== undefined || payload.role.toUpperCase() === 'MERCHANT_APPLICATION_STATUS';

export const isAllowedMerchantApplicationStatusRequest = (
  payload: TokenPayload,
  method: string,
  path: string,
): boolean => payload.role === 'MERCHANT_APPLICATION_STATUS'
  && payload.tokenScope === 'MERCHANT_APPLICATION_STATUS'
  && method === 'GET'
  && path === '/api/merchant-applications/me/status';

export const signToken = (
  payload: TokenPayload,
  expiresIn: jwt.SignOptions['expiresIn'] = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
  } as jwt.SignOptions);
};

export const signMerchantApplicationStatusToken = (applicationId: string): string => signToken({
  userId: applicationId,
  role: 'MERCHANT_APPLICATION_STATUS',
  tokenScope: 'MERCHANT_APPLICATION_STATUS',
}, '15m');

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
