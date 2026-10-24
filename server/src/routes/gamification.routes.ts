import { Router } from 'express';
import {
  createBadge,
  createBadgeConfig,
  createCampaign,
  createQuest,
  createReward,
  listBadges,
  listBadgeConfigs,
  listCampaigns,
  listQuests,
  listRewards,
  updateBadge,
  updateBadgeConfig,
  updateCampaign,
  updateQuest,
  updateReward,
} from '../controllers/gamification.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createBadgeSchema,
  createBadgeConfigSchema,
  createCampaignSchema,
  createQuestSchema,
  createRewardSchema,
  updateBadgeSchema,
  updateBadgeConfigSchema,
  updateCampaignSchema,
  updateQuestSchema,
  updateRewardSchema,
} from '../validations/gamification.validation';

const router = Router();

router.get('/campaigns', authenticateAdmin, listCampaigns);
router.post('/campaigns', authenticateAdmin, validate(createCampaignSchema), createCampaign);
router.patch('/campaigns/:id', authenticateAdmin, validate(updateCampaignSchema), updateCampaign);

router.get('/quests', authenticateAdmin, listQuests);
router.post('/quests', authenticateAdmin, validate(createQuestSchema), createQuest);
router.patch('/quests/:id', authenticateAdmin, validate(updateQuestSchema), updateQuest);

router.get('/rewards', authenticateAdmin, listRewards);
router.post('/rewards', authenticateAdmin, validate(createRewardSchema), createReward);
router.patch('/rewards/:id', authenticateAdmin, validate(updateRewardSchema), updateReward);

router.get('/badges', authenticateAdmin, listBadges);
router.post('/badges', authenticateAdmin, validate(createBadgeSchema), createBadge);
router.patch('/badges/:id', authenticateAdmin, validate(updateBadgeSchema), updateBadge);

router.get('/badge-configs', authenticateAdmin, listBadgeConfigs);
router.post('/badge-configs', authenticateAdmin, validate(createBadgeConfigSchema), createBadgeConfig);
router.patch('/badge-configs/:id', authenticateAdmin, validate(updateBadgeConfigSchema), updateBadgeConfig);

export default router;
