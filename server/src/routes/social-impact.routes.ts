import { Router } from 'express';
import {
  getSocialImpactDashboard,
  getSocialImpactHeatmap,
  getSocialImpactSummary,
} from '../controllers/socialImpact.controller';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/summary', authenticate, requireAdmin, getSocialImpactSummary);
router.get('/heatmap', authenticate, requireAdmin, getSocialImpactHeatmap);
router.get('/dashboard', authenticate, requireAdmin, getSocialImpactDashboard);

export default router;