import { Router } from 'express';
import { getSocialImpactHeatmap, getSocialImpactSummary } from '../controllers/socialImpact.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/summary', authenticate, requireAdmin, getSocialImpactSummary);
router.get('/heatmap', authenticate, requireAdmin, getSocialImpactHeatmap);

export default router;
