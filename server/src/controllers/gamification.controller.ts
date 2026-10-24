import { Request, Response } from 'express';
import { GamificationServiceError, gamificationService } from '../services/gamification.service';
import { uuidParamSchema } from '../validations/gamification.validation';
import { sendError, sendSuccess } from '../utils/response';

const run = async (
  res: Response,
  operation: () => Promise<unknown>,
  successMessage: string,
  statusCode = 200
): Promise<void> => {
  try {
    sendSuccess(res, await operation(), successMessage, statusCode);
  } catch (error) {
    if (error instanceof GamificationServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, 'Unable to complete the request', 500);
  }
};

const withId = (req: Request, res: Response, action: (id: string) => Promise<unknown>): Promise<void> => {
  const parsed = uuidParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    sendError(res, 'Invalid record ID', 400);
    return Promise.resolve();
  }
  return run(res, () => action(parsed.data), 'Record updated successfully');
};

export const listCampaigns = (_req: Request, res: Response) => run(res, gamificationService.listCampaigns, 'Campaigns loaded');
export const createCampaign = (req: Request, res: Response) => run(res, () => gamificationService.createCampaign(req.body), 'Campaign created', 201);
export const updateCampaign = (req: Request, res: Response) => withId(req, res, (id) => gamificationService.updateCampaign(id, req.body));

export const listQuests = (_req: Request, res: Response) => run(res, gamificationService.listQuests, 'Missions loaded');
export const createQuest = (req: Request, res: Response) => run(res, () => gamificationService.createQuest(req.body), 'Mission created', 201);
export const updateQuest = (req: Request, res: Response) => withId(req, res, (id) => gamificationService.updateQuest(id, req.body));

export const listRewards = (_req: Request, res: Response) => run(res, gamificationService.listRewards, 'Rewards loaded');
export const createReward = (req: Request, res: Response) => run(res, () => gamificationService.createReward(req.body), 'Reward created', 201);
export const updateReward = (req: Request, res: Response) => withId(req, res, (id) => gamificationService.updateReward(id, req.body));

export const listBadges = (_req: Request, res: Response) => run(res, gamificationService.listBadges, 'Badges loaded');
export const createBadge = (req: Request, res: Response) => run(res, () => gamificationService.createBadge(req.body), 'Badge created', 201);
export const updateBadge = (req: Request, res: Response) => withId(req, res, (id) => gamificationService.updateBadge(id, req.body));
export const listBadgeConfigs = (_req: Request, res: Response) => run(res, gamificationService.listBadgeConfigs, 'Badge configurations loaded');
export const createBadgeConfig = (req: Request, res: Response) => run(res, () => gamificationService.createBadgeConfig(req.body), 'Badge configuration created', 201);
export const updateBadgeConfig = (req: Request, res: Response) => withId(req, res, (id) => gamificationService.updateBadgeConfig(id, req.body));
