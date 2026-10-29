import { Router } from 'express';
import {
  createCampaign,
  createQuest,
  createReward,
  listCampaigns,
  listQuests,
  listRewards,
  updateCampaign,
  updateQuest,
  updateReward,
} from '../controllers/gamification.controller';
import {
  activateAdminBadge,
  createAdminBadge,
  deactivateAdminBadge,
  getAdminBadge,
  listAdminBadges,
  listBadgeConditionTypes,
  updateAdminBadge,
  updateAdminBadgeImplementationStatus,
} from '../controllers/adminBadge.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';
import { getMyBadge, listMyBadges } from '../controllers/badge.controller';
import { listMyMissions } from '../controllers/citizenMission.controller';
import {
  createAdminConditionType,
  getAdminConditionType,
  listAdminConditionTypes,
  updateAdminConditionType,
} from '../controllers/adminConditionType.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  createCampaignSchema,
  createQuestSchema,
  createRewardSchema,
  updateCampaignSchema,
  updateQuestSchema,
  updateRewardSchema,
} from '../validations/gamification.validation';
import {
  badgeCreateSchema,
  badgeImplementationStatusSchema,
  badgeUpdateSchema,
} from '../validations/badge-management.validation';
import {
  conditionTypeCreateSchema,
  conditionTypeUpdateSchema,
} from '../validations/condition-type.validation';

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

router.get('/badge-condition-types', authenticateAdmin, listBadgeConditionTypes);
router.get('/condition-types', authenticateAdmin, listAdminConditionTypes);
router.post('/condition-types', authenticateAdmin, validate(conditionTypeCreateSchema), createAdminConditionType);
router.get('/condition-types/:id', authenticateAdmin, getAdminConditionType);
router.patch('/condition-types/:id', authenticateAdmin, validate(conditionTypeUpdateSchema), updateAdminConditionType);
router.get('/badges', authenticateAdmin, listAdminBadges);
router.post('/badges', authenticateAdmin, validate(badgeCreateSchema), createAdminBadge);
router.get('/badges/:id', authenticateAdmin, getAdminBadge);
router.patch('/badges/:id', authenticateAdmin, validate(badgeUpdateSchema), updateAdminBadge);
router.patch('/badges/:id/implementation-status', authenticateAdmin, validate(badgeImplementationStatusSchema), updateAdminBadgeImplementationStatus);
router.post('/badges/:id/activate', authenticateAdmin, activateAdminBadge);
router.post('/badges/:id/deactivate', authenticateAdmin, deactivateAdminBadge);

// Citizen Badge progress. The user comes from the authenticated request context.
router.get('/me/badges', authenticate, requireCitizen, listMyBadges);
router.get('/me/badges/:badgeId', authenticate, requireCitizen, getMyBadge);
router.get('/me/missions', authenticate, requireCitizen, listMyMissions);

export default router;
