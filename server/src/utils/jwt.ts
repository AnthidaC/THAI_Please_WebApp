import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  role: string;
  /** Restricts an unapproved merchant session to its own application status endpoint. */
  tokenScope?: 'MERCHANT_APPLICATION_STATUS';
  /** Issued-at (seconds), set by jsonwebtoken. */
  iat?: number;
  /** Marks a mock account session. */
  isDemo?: boolean;
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
