import { Router, Request, Response } from 'express';
import compression from 'compression';
import fs from 'fs';
import path from 'path';

const router = Router();

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