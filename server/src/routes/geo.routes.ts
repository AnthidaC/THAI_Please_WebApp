import { Router, Request, Response } from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

const router = Router();

// Rate limiting for IP location lookup to prevent abuse
const ipLocationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // max 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Checks if an IP is local, loopback, or private range.
 * Never log the IP address to protect user privacy.
 */
const isPrivateOrLocalIp = (ip?: string): boolean => {
  if (!ip) return true;
  const cleanIp = ip.replace(/^::ffff:/, '').trim();
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('172.16.') ||
    cleanIp.startsWith('172.17.') ||
    cleanIp.startsWith('172.18.') ||
    cleanIp.startsWith('172.19.') ||
    cleanIp.startsWith('172.2') ||
    cleanIp.startsWith('172.30.') ||
    cleanIp.startsWith('172.31.') ||
    cleanIp.startsWith('fc00:') ||
    cleanIp.startsWith('fe80:')
  ) {
    return true;
  }
  return false;
};

/**
 * GET /api/geo/ip-location
 * Resolves approximate latitude/longitude from client IP without exposing external APIs to client.
 * Privacy-first: NEVER logs IP address. If private/localhost or lookup fails, returns null.
 */
router.get('/ip-location', ipLocationLimiter, async (req: Request, res: Response): Promise<void> => {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

  if (isPrivateOrLocalIp(rawIp)) {
    res.json({
      success: true,
      data: {
        latitude: null,
        longitude: null,
        isApproximate: true,
      },
    });
    return;
  }

  const cleanIp = (rawIp || '').replace(/^::ffff:/, '').trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(`https://ipapi.co/${cleanIp}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ThaiPlease-Server-Geo/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json({ success: true, data: { latitude: null, longitude: null, isApproximate: true } });
      return;
    }

    const json = (await response.json()) as { latitude?: number; longitude?: number };
    if (typeof json.latitude === 'number' && typeof json.longitude === 'number') {
      res.json({
        success: true,
        data: {
          latitude: json.latitude,
          longitude: json.longitude,
          isApproximate: true,
        },
      });
      return;
    }

    res.json({ success: true, data: { latitude: null, longitude: null, isApproximate: true } });
  } catch {
    // Fail closed safely without crashing form or logging IP
    res.json({ success: true, data: { latitude: null, longitude: null, isApproximate: true } });
  }
});

// หาโฟลเดอร์ข้อมูลขอบเขตจากหลายตำแหน่ง ไม่ขึ้นกับว่ารันจาก root หรือ server/
const GEO_DIR =
  [
    process.env.GEO_DIR,
    path.resolve(process.cwd(), 'assets', 'geo'),
    path.resolve(process.cwd(), 'server', 'assets', 'geo'),
  ]
    .filter((p): p is string => Boolean(p))
    .map((p) => path.resolve(p))
    .find((p) => fs.existsSync(p)) ?? path.resolve(process.cwd(), 'assets', 'geo');

// อนุญาตเฉพาะชื่อไฟล์ธรรมดา กัน path traversal
const SAFE_NAME = /^[A-Za-z0-9._-]+\.(geojson|json|md|txt)$/;

router.use(compression());

// รายการไฟล์ที่มี
router.get('/', (_req: Request, res: Response) => {
  if (!fs.existsSync(GEO_DIR)) {
    res.json({ files: [] });
    return;
  }
  res.json({ files: fs.readdirSync(GEO_DIR).filter((f) => SAFE_NAME.test(f)) });
});

router.get('/:file', (req: Request, res: Response) => {
  const raw = req.params.file;
  const file = Array.isArray(raw) ? raw[0] : raw;

  if (!file || !SAFE_NAME.test(file)) {
    res.status(400).json({ success: false, message: 'ชื่อไฟล์ไม่ถูกต้อง' });
    return;
  }

  const full = path.join(GEO_DIR, file);
  if (!full.startsWith(GEO_DIR + path.sep) || !fs.existsSync(full)) {
    res.status(404).json({ success: false, message: 'ไม่พบข้อมูลขอบเขตพื้นที่' });
    return;
  }

  if (file.endsWith('.geojson') || file.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(full);
});

export default router;
