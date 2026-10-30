import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { HttpError } from '../utils/http-error';
import { MerchantProfileInput } from '../validations/merchant-profile.validation';

type Actor = { id: string; role: 'MERCHANT' | 'ADMIN' | 'STAFF' };
type ProfileChanges = Record<string, { from: string | number; to: string | number }>;

const toNumber = (value: Prisma.Decimal): number => Number(value);

const getProfile = async (merchantId: string) => {
  const merchant = await prisma.merchants.findUnique({
    where: { merchant_id: merchantId, is_approved: true },
    include: {
      merchant_application: {
        select: {
          application_id: true,
          tax_id: true,
          shop_name: true,
          contact_name: true,
          email: true,
          phone: true,
          address: true,
        },
      },
      location_change_requests: {
        where: { status: 'PENDING' },
        select: {
          request_id: true,
          requested_latitude: true,
          requested_longitude: true,
          requested_at: true,
        },
        take: 1,
      },
    },
  });
  if (!merchant) throw new HttpError(404, 'ไม่พบข้อมูลร้านค้าที่ได้รับอนุมัติ');

  const pending = merchant.location_change_requests[0];
  return {
    merchantId: merchant.merchant_id,
    taxId: merchant.tax_id,
    businessName: merchant.shop_name,
    contactName: merchant.merchant_application?.contact_name || merchant.shop_name,
    email: merchant.merchant_application?.email || `${merchant.tax_id.toLowerCase()}@demo.thaiplease.go.th`,
    phone: merchant.merchant_application?.phone || '0800000000',
    address: merchant.merchant_application?.address || 'ม.เกษตรศาสตร์ วิทยาเขตกำแพงแสน อ.กำแพงแสน จ.นครปฐม 73140',
    latitude: toNumber(merchant.latitude),
    longitude: toNumber(merchant.longitude),
    pendingLocation: pending ? {
      requestId: pending.request_id,
      latitude: toNumber(pending.requested_latitude),
      longitude: toNumber(pending.requested_longitude),
      requestedAt: pending.requested_at,
    } : null,
  };
};

const saveAudit = async (
  transaction: Prisma.TransactionClient,
  merchantId: string,
  actor: Actor,
  changes: ProfileChanges
) => {
  if (Object.keys(changes).length === 0) return;
  await transaction.merchantProfileAuditLog.create({
    data: {
      merchant_id: merchantId,
      actor_id: actor.id,
      actor_role: actor.role,
      changes: changes as Prisma.InputJsonValue,
    },
  });
};

const updateProfile = async (merchantId: string, actor: Actor, input: MerchantProfileInput) => {
  const merchant = await prisma.merchants.findUnique({
    where: { merchant_id: merchantId, is_approved: true },
    include: { merchant_application: true },
  });
  if (!merchant) throw new HttpError(404, 'ไม่พบข้อมูลร้านค้าที่ได้รับอนุมัติ');
  let application = merchant?.merchant_application;
  if (!application) {
    application = await prisma.merchantApplication.create({
      data: {
        merchant_id: merchantId,
        business_type: 'INDIVIDUAL',
        tax_id: merchant.tax_id,
        shop_name: input.businessName || merchant.shop_name,
        contact_name: input.contactName || merchant.shop_name,
        email: input.email || `${merchant.tax_id.toLowerCase()}@demo.thaiplease.go.th`,
        phone: input.phone || '0800000000',
        password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
        address: input.address || 'ม.เกษตรศาสตร์ วิทยาเขตกำแพงแสน อ.กำแพงแสน จ.นครปฐม 73140',
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        status: 'APPROVED',
      },
    });
  }


  const isStaff = actor.role === 'ADMIN' || actor.role === 'STAFF';
  const oldValues = {
    businessName: application.shop_name,
    contactName: application.contact_name,
    email: application.email,
    phone: application.phone,
    address: application.address,
    latitude: toNumber(merchant.latitude),
    longitude: toNumber(merchant.longitude),
  };
  const changes: ProfileChanges = {};
  const compareAndRecord = (key: keyof typeof oldValues, value: string | number) => {
    if (oldValues[key] !== value) changes[key] = { from: oldValues[key], to: value };
  };
  compareAndRecord('businessName', input.businessName);
  compareAndRecord('contactName', input.contactName);
  compareAndRecord('email', input.email);
  compareAndRecord('phone', input.phone);
  compareAndRecord('address', input.address);

  const coordinatesChanged = oldValues.latitude !== input.latitude || oldValues.longitude !== input.longitude;
  if (isStaff && coordinatesChanged) {
    compareAndRecord('latitude', input.latitude);
    compareAndRecord('longitude', input.longitude);
  }

  try {
    await prisma.$transaction(async (transaction) => {
      if (Object.keys(changes).some((key) => key !== 'latitude' && key !== 'longitude')) {
        await transaction.merchantApplication.update({
          where: { application_id: application.application_id },
          data: {
            shop_name: input.businessName,
            contact_name: input.contactName,
            email: input.email,
            phone: input.phone,
            address: input.address,
            updated_at: new Date(),
          },
        });
        await transaction.merchants.update({
          where: { merchant_id: merchantId },
          data: { shop_name: input.businessName },
        });
      }

      if (isStaff && coordinatesChanged) {
        await transaction.merchants.update({
          where: { merchant_id: merchantId },
          data: { latitude: input.latitude, longitude: input.longitude },
        });
        await transaction.merchantApplication.update({
          where: { application_id: application.application_id },
          data: { latitude: input.latitude, longitude: input.longitude, updated_at: new Date() },
        });
        await transaction.merchantLocationChangeRequest.updateMany({
          where: { merchant_id: merchantId, status: 'PENDING' },
          data: {
            status: 'REJECTED',
            reviewed_at: new Date(),
            reviewed_by_staff_id: actor.id,
            review_note: 'พิกัดถูกแก้ไขโดยเจ้าหน้าที่',
          },
        });
      } else if (!isStaff) {
        const currentPending = await transaction.merchantLocationChangeRequest.findFirst({
          where: { merchant_id: merchantId, status: 'PENDING' },
          select: { request_id: true, requested_latitude: true, requested_longitude: true },
        });
        if (input.latitude === oldValues.latitude && input.longitude === oldValues.longitude) {
          if (currentPending) {
            await transaction.merchantLocationChangeRequest.update({
              where: { request_id: currentPending.request_id },
              data: { status: 'REJECTED', reviewed_at: new Date(), review_note: 'ยกเลิกโดยร้านค้า' },
            });
          }
        } else if (currentPending
          && (Number(currentPending.requested_latitude) !== input.latitude
            || Number(currentPending.requested_longitude) !== input.longitude)) {
          await transaction.merchantLocationChangeRequest.update({
            where: { request_id: currentPending.request_id },
            data: {
              status: 'REJECTED',
              reviewed_at: new Date(),
              review_note: 'แทนที่ด้วยคำขอเปลี่ยนพิกัดใหม่จากร้านค้า',
            },
          });
          await transaction.merchantLocationChangeRequest.create({
            data: {
              merchant_id: merchantId,
              requested_latitude: input.latitude,
              requested_longitude: input.longitude,
            },
          });
        } else if (!currentPending && coordinatesChanged) {
          await transaction.merchantLocationChangeRequest.create({
            data: {
              merchant_id: merchantId,
              requested_latitude: input.latitude,
              requested_longitude: input.longitude,
            },
          });
        }
      }
      await saveAudit(transaction, merchantId, actor, changes);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'อีเมลนี้ถูกใช้กับคำขอร้านค้าอื่นแล้ว');
    }
    throw error;
  }

  return getProfile(merchantId);
};

export const merchantProfileService = {
  getProfile,
  updateOwnProfile: (merchantId: string, input: MerchantProfileInput) =>
    updateProfile(merchantId, { id: merchantId, role: 'MERCHANT' }, input),
  updateByStaff: (merchantId: string, staffId: string, role: 'ADMIN' | 'STAFF', input: MerchantProfileInput) =>
    updateProfile(merchantId, { id: staffId, role }, input),

  async listApproved() {
    const applications = await prisma.merchantApplication.findMany({
      where: { status: 'APPROVED', merchant_id: { not: null } },
      orderBy: { shop_name: 'asc' },
      select: {
        merchant_id: true,
        shop_name: true,
        tax_id: true,
        address: true,
        merchant: { select: { latitude: true, longitude: true } },
      },
    });
    return applications.flatMap((application) => application.merchant_id && application.merchant
      ? [{
        merchantId: application.merchant_id,
        businessName: application.shop_name,
        taxId: application.tax_id,
        address: application.address,
        latitude: toNumber(application.merchant.latitude),
        longitude: toNumber(application.merchant.longitude),
      }]
      : []);
  },

  async listPendingLocationChanges() {
    const requests = await prisma.merchantLocationChangeRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requested_at: 'asc' },
      select: {
        request_id: true,
        requested_latitude: true,
        requested_longitude: true,
        requested_at: true,
        merchant: {
          select: {
            merchant_id: true,
            shop_name: true,
            latitude: true,
            longitude: true,
            merchant_application: { select: { address: true, tax_id: true } },
          },
        },
      },
    });
    return requests.map((request) => ({
      requestId: request.request_id,
      requestedAt: request.requested_at,
      merchantId: request.merchant.merchant_id,
      businessName: request.merchant.shop_name,
      taxId: request.merchant.merchant_application?.tax_id ?? '',
      address: request.merchant.merchant_application?.address ?? '',
      currentLatitude: toNumber(request.merchant.latitude),
      currentLongitude: toNumber(request.merchant.longitude),
      requestedLatitude: toNumber(request.requested_latitude),
      requestedLongitude: toNumber(request.requested_longitude),
    }));
  },

  async decideLocationChange(
    requestId: string,
    staffId: string,
    action: 'APPROVE' | 'REJECT',
    note?: string,
    staffRole: 'ADMIN' | 'STAFF' = 'ADMIN'
  ) {
    return prisma.$transaction(async (transaction) => {
      const request = await transaction.merchantLocationChangeRequest.findFirst({
        where: { request_id: requestId, status: 'PENDING' },
        include: { merchant: { include: { merchant_application: true } } },
      });
      if (!request) throw new HttpError(409, 'คำขอเปลี่ยนพิกัดนี้ถูกดำเนินการแล้ว');

      const updated = await transaction.merchantLocationChangeRequest.updateMany({
        where: { request_id: requestId, status: 'PENDING' },
        data: {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewed_at: new Date(),
          reviewed_by_staff_id: staffId,
          review_note: note ?? null,
        },
      });
      if (updated.count !== 1) throw new HttpError(409, 'คำขอเปลี่ยนพิกัดนี้ถูกดำเนินการแล้ว');

      if (action === 'APPROVE') {
        await transaction.merchants.update({
          where: { merchant_id: request.merchant_id },
          data: { latitude: request.requested_latitude, longitude: request.requested_longitude },
        });
        if (request.merchant.merchant_application) {
          await transaction.merchantApplication.update({
            where: { application_id: request.merchant.merchant_application.application_id },
            data: {
              latitude: request.requested_latitude,
              longitude: request.requested_longitude,
              updated_at: new Date(),
            },
          });
        }
        await saveAudit(transaction, request.merchant_id, { id: staffId, role: staffRole }, {
          latitude: {
            from: toNumber(request.merchant.latitude),
            to: toNumber(request.requested_latitude),
          },
          longitude: {
            from: toNumber(request.merchant.longitude),
            to: toNumber(request.requested_longitude),
          },
        });
      }

      return { requestId, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
    });
  },
};
