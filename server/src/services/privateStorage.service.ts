import { env } from '../config/env';
import { HttpError } from '../utils/http-error';

const storageUrl = (): string => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'ระบบจัดเก็บเอกสารยังไม่ได้ตั้งค่า');
  }
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1`;
};

const storageHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  apikey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
});

let privateBucketCheck: Promise<void> | null = null;
let privateBucketVerifiedAt = 0;

const assertPrivateBucket = async (): Promise<void> => {
  if (privateBucketVerifiedAt > Date.now() - 60_000) return;
  privateBucketCheck = null;
  if (!privateBucketCheck) {
    privateBucketCheck = (async () => {
      const response = await fetch(
        `${storageUrl()}/bucket/${encodeURIComponent(env.MERCHANT_DOCUMENTS_BUCKET)}`,
        { headers: storageHeaders(), signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) {
        console.error('Merchant document bucket check failed', { status: response.status });
        throw new HttpError(503, 'ไม่พบ private bucket สำหรับจัดเก็บเอกสาร');
      }
      const bucket = (await response.json()) as { public?: boolean };
      if (bucket.public !== false) {
        throw new HttpError(503, 'bucket เอกสารต้องตั้งค่าเป็น private ก่อนรับไฟล์');
      }
    })().catch((error: unknown) => {
      privateBucketCheck = null;
      throw error;
    });
  }
  await privateBucketCheck;
  privateBucketVerifiedAt = Date.now();
  privateBucketCheck = null;
};

export const privateStorageService = {
  async upload(path: string, file: Express.Multer.File): Promise<void> {
    await assertPrivateBucket();
    const response = await fetch(
      `${storageUrl()}/object/${encodeURIComponent(env.MERCHANT_DOCUMENTS_BUCKET)}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      {
        method: 'POST',
        headers: {
          ...storageHeaders(),
          'Content-Type': file.mimetype,
          'x-upsert': 'false',
        },
        body: new Uint8Array(file.buffer),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      console.error('Private document upload failed', { status: response.status });
      throw new HttpError(502, 'ไม่สามารถจัดเก็บเอกสารได้ กรุณาลองใหม่ภายหลัง');
    }
  },

  async remove(path: string): Promise<void> {
    const response = await fetch(
      `${storageUrl()}/object/${encodeURIComponent(env.MERCHANT_DOCUMENTS_BUCKET)}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      {
        method: 'DELETE',
        headers: storageHeaders(),
      }
    );
    if (!response.ok) {
      console.error('Private document cleanup failed', { status: response.status });
    }
  },

  async createSignedUrl(path: string): Promise<string> {
    await assertPrivateBucket();
    const response = await fetch(
      `${storageUrl()}/object/sign/${encodeURIComponent(env.MERCHANT_DOCUMENTS_BUCKET)}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      {
        method: 'POST',
        headers: {
          ...storageHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.error('Private document signed URL creation failed', { status: response.status });
      throw new HttpError(502, 'ไม่สามารถเปิดเอกสารได้ในขณะนี้');
    }

    const result = (await response.json()) as { signedURL?: string };
    if (!result.signedURL) {
      throw new HttpError(502, 'ไม่สามารถเปิดเอกสารได้ในขณะนี้');
    }
    return result.signedURL.startsWith('http')
      ? result.signedURL
      : `${storageUrl()}${result.signedURL.startsWith('/') ? result.signedURL : `/${result.signedURL}`}`;
  },
};
