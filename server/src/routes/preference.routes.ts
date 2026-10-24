import { Router } from 'express';
import { getPreferences, updatePreferences } from '../controllers/preference.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updatePreferencesSchema } from '../validations/preference.validation';

const router = Router();

// GET /api/preferences - ดึงรายการหมวดหมู่ความสนใจของผู้ใช้ (Authenticated)
router.get('/', authenticate, getPreferences);

// PUT /api/preferences - บันทึกหรือปรับปรุงหมวดหมู่ความสนใจของผู้ใช้ (Authenticated)
router.put('/', authenticate, validate(updatePreferencesSchema), updatePreferences);

export default router;
