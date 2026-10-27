import { Request, Response } from 'express';
import { getCitizenBadge, listCitizenBadges } from '../services/citizenBadge.service';
import { sendError, sendSuccess } from '../utils/response';
import { badgeIdParamSchema } from '../validations/badge-management.validation';

export const listMyBadges = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const badges = await listCitizenBadges(userId);
    sendSuccess(res, badges, 'Badges loaded');
  } catch (error) {
    console.error('Failed to load citizen Badges', error);
    sendError(res, 'Unable to load Badges', 500);
  }
};

export const getMyBadge = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const parsed = badgeIdParamSchema.safeParse(req.params.badgeId);
  if (!parsed.success) {
    sendError(res, 'Invalid Badge ID', 400);
    return;
  }

  try {
    const badge = await getCitizenBadge(userId, parsed.data);
    if (!badge) {
      sendError(res, 'Badge not found', 404);
      return;
    }
    sendSuccess(res, badge, 'Badge loaded');
  } catch (error) {
    console.error('Failed to load citizen Badge', error);
    sendError(res, 'Unable to load Badge', 500);
  }
};
