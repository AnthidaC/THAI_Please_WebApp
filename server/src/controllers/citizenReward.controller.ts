import { Request, Response } from 'express';
import { listCitizenRewards } from '../services/citizenReward.service';
import { sendError, sendSuccess } from '../utils/response';

export const listMyRewards = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const rewards = await listCitizenRewards(userId);
    sendSuccess(res, rewards, 'Rewards loaded');
  } catch (error) {
    console.error('Failed to load citizen rewards', error);
    sendError(res, 'Unable to load rewards', 500);
  }
};
