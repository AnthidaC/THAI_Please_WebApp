import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/bcrypt';

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_WINDOW_MS = 10 * 60 * 1000;
type PinRecord = { pin_hash: string; failed_attempts: number; locked_until: Date | null };

export class PaymentPinError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode = 400) {
    super(message);
  }
}

export class PaymentPinService {
  async getStatus(userId: string) {
    const pin = await prisma.payment_pins.findUnique({
      where: { user_id: userId },
      select: { locked_until: true },
    });
    return { isSet: Boolean(pin), lockedUntil: pin?.locked_until?.toISOString() ?? null };
  }

  private async check(tx: Prisma.TransactionClient, userId: string, pin: string) {
    const rows = await tx.$queryRaw<PinRecord[]>`
      SELECT pin_hash, failed_attempts, locked_until FROM payment_pins
      WHERE user_id = ${userId}::uuid FOR UPDATE`;
    const record = rows[0];
    if (!record) return new PaymentPinError('กรุณาตั้งรหัส PIN ก่อนชำระเงิน', 'PIN_NOT_SET');
    if (record.locked_until && record.locked_until.getTime() > Date.now()) {
      return new PaymentPinError('กรอกรหัส PIN ผิดครบ 5 ครั้ง กรุณารอ 15 นาทีแล้วลองใหม่', 'PIN_LOCKED', 429);
    }
    if (!await comparePassword(pin, record.pin_hash)) {
      const attempts = record.locked_until ? 1 : record.failed_attempts + 1;
      await tx.payment_pins.update({
        where: { user_id: userId },
        data: {
          failed_attempts: attempts,
          locked_until: attempts >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
          updated_at: new Date(),
        },
      });
      return new PaymentPinError(
        attempts >= MAX_FAILURES ? 'กรอกรหัส PIN ผิดครบ 5 ครั้ง กรุณารอ 15 นาทีแล้วลองใหม่' : `รหัส PIN ไม่ถูกต้อง เหลืออีก ${MAX_FAILURES - attempts} ครั้ง`,
        attempts >= MAX_FAILURES ? 'PIN_LOCKED' : 'PIN_INCORRECT',
        attempts >= MAX_FAILURES ? 429 : 400
      );
    }
    await tx.payment_pins.update({
      where: { user_id: userId },
      data: { failed_attempts: 0, locked_until: null, updated_at: new Date() },
    });
    return null;
  }

  async verify(userId: string, pin: string) {
    if (!/^\d{6}$/.test(pin || '')) {
      throw new PaymentPinError('กรุณาระบุรหัส PIN 6 หลัก', 'PIN_REQUIRED');
    }
    // Return failures so the attempt counter commits before the error is raised.
    const error = await prisma.$transaction(tx => this.check(tx, userId, pin));
    if (error) throw error;
  }

  async setPin(userId: string, pin: string, currentPin?: string) {
    if (!/^\d{6}$/.test(pin)) throw new PaymentPinError('รหัส PIN ต้องเป็นตัวเลข 6 หลัก', 'PIN_INVALID');
    const hash = await hashPassword(pin);
    const error = await prisma.$transaction(async tx => {
      // Serialize first-time setup too, when no PIN row exists yet.
      await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.payment_pins.findUnique({ where: { user_id: userId } });
      if (existing) {
        if (!/^\d{6}$/.test(currentPin || '')) {
          return new PaymentPinError('กรุณาระบุ PIN ปัจจุบันเพื่อเปลี่ยนรหัส', 'CURRENT_PIN_REQUIRED');
        }
        const failure = await this.check(tx, userId, currentPin!);
        if (failure) return failure;
      }
      await tx.payment_pins.upsert({
        where: { user_id: userId },
        create: { user_id: userId, pin_hash: hash },
        update: { pin_hash: hash, failed_attempts: 0, locked_until: null, updated_at: new Date() },
      });
      return null;
    });
    if (error) throw error;
    return { isSet: true };
  }

  /**
   * Forgot-PIN reset: skips the current PIN but only for a session signed in within
   * RESET_WINDOW_MS, so re-entering the account password is the identity check.
   */
  async resetPin(userId: string, pin: string, session: { iat?: number; isDemo?: boolean }) {
    if (!/^\d{6}$/.test(pin)) throw new PaymentPinError('รหัส PIN ต้องเป็นตัวเลข 6 หลัก', 'PIN_INVALID');
    const issuedAtMs = (session.iat ?? 0) * 1000;
    if (!session.isDemo && Date.now() - issuedAtMs > RESET_WINDOW_MS) {
      throw new PaymentPinError('เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ก่อนตั้งรหัส PIN ใหม่', 'REAUTH_REQUIRED', 403);
    }
    const hash = await hashPassword(pin);
    await prisma.payment_pins.upsert({
      where: { user_id: userId },
      create: { user_id: userId, pin_hash: hash },
      update: { pin_hash: hash, failed_attempts: 0, locked_until: null, updated_at: new Date() },
    });
    return { isSet: true };
  }
}

export const paymentPinService = new PaymentPinService();
