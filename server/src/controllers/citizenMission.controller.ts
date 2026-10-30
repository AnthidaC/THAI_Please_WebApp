import { Request, Response } from 'express';
import { listCitizenMissions } from '../services/citizenMission.service';
import { sendError, sendSuccess } from '../utils/response';

export const listMyMissions = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const missions = await listCitizenMissions(userId);
    sendSuccess(res, missions, 'Missions loaded');
  } catch (error) {
    console.error('Failed to load citizen missions', error);
    sendError(res, 'Unable to load missions', 500);
  }
};
