import { Request, Response } from 'express';
import { ReviewServiceError, createReview } from '../services/review.service';
import { sendError, sendSuccess } from '../utils/response';

export const submitReview = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  try {
    const review = await createReview(userId, req.body);
    sendSuccess(res, review, 'Review saved', 201);
  } catch (error) {
    if (error instanceof ReviewServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Failed to save review', error);
    sendError(res, 'Unable to save review', 500);
  }
};
