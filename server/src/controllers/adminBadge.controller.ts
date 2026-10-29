import { Request, Response } from 'express';
import { AdminBadgeServiceError, adminBadgeService } from '../services/adminBadge.service';
import { sendError, sendSuccess } from '../utils/response';
import {
  badgeIdParamSchema,
  badgeListQuerySchema,
} from '../validations/badge-management.validation';

const run = async (
  res: Response,
  operation: () => Promise<unknown>,
  successMessage: string,
  statusCode = 200
): Promise<void> => {
  try {
    sendSuccess(res, await operation(), successMessage, statusCode);
  } catch (error) {
    if (error instanceof AdminBadgeServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Admin Badge request failed', error);
    sendError(res, 'Unable to complete the Badge request', 500);
  }
};

const withId = (
  req: Request,
  res: Response,
  action: (id: string) => Promise<unknown>,
  successMessage: string
): Promise<void> => {
  const parsed = badgeIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    sendError(res, 'Invalid Badge ID', 400);
    return Promise.resolve();
  }
  return run(res, () => action(parsed.data), successMessage);
};

export const listAdminBadges = (req: Request, res: Response) => {
  const parsed = badgeListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 'Invalid Badge filters', 400, parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })));
    return;
  }
  return run(res, () => adminBadgeService.list(parsed.data), 'Badges loaded');
};

export const getAdminBadge = (req: Request, res: Response) =>
  withId(req, res, adminBadgeService.get, 'Badge loaded');

export const createAdminBadge = (req: Request, res: Response) =>
  run(res, () => adminBadgeService.create(req.body), 'Badge created and left inactive pending implementation', 201);

export const updateAdminBadge = (req: Request, res: Response) =>
  withId(req, res, (id) => adminBadgeService.update(id, req.body), 'Badge updated');

export const updateAdminBadgeImplementationStatus = (req: Request, res: Response) =>
  withId(
    req,
    res,
    (id) => adminBadgeService.updateImplementationStatus(id, req.body.implementationStatus),
    'Badge implementation status updated'
  );

export const activateAdminBadge = (req: Request, res: Response) =>
  withId(req, res, adminBadgeService.activate, 'Badge activated');

export const deactivateAdminBadge = (req: Request, res: Response) =>
  withId(req, res, adminBadgeService.deactivate, 'Badge deactivated');

export const listBadgeConditionTypes = (_req: Request, res: Response) =>
  run(res, adminBadgeService.listConditionTypes, 'Registered Badge conditions loaded');

