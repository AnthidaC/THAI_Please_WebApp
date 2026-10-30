import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import type { DynamicQrData } from './payment.service';

/** Shared across processes; status in the column is authoritative over JSON metadata. */
export const qrStore = {
  async get(reference: string): Promise<DynamicQrData | undefined> {
    const record = await prisma.payment_qr_codes.findUnique({ where: { qr_reference: reference } });
    if (!record) return undefined;
    return {
      ...(record.payload as unknown as DynamicQrData),
      status: record.status as DynamicQrData['status'],
      expiresAt: record.expires_at.toISOString(),
    };
  },
  async set(reference: string, data: DynamicQrData) {
    const payload = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
    if (data.status === 'ACTIVE') {
      await prisma.payment_qr_codes.create({ data: {
        qr_reference: reference, merchant_id: data.merchantId,
        payload, status: 'ACTIVE', expires_at: new Date(data.expiresAt),
      } });
    } else {
      // A late preview/expiry must never overwrite a committed payment.
      await prisma.payment_qr_codes.updateMany({
        where: { qr_reference: reference, status: { in: data.status === 'USED' ? ['ACTIVE', 'USED'] : ['ACTIVE'] } },
        data: { payload, status: data.status, expires_at: new Date(data.expiresAt) },
      });
    }
  },
};
