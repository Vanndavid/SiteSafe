import type { Request } from 'express';

export const getRequestUserId = (req: Request): string => {
  const userId = req.auth?.userId;

  if (!userId) {
    throw new Error('Authenticated user id is required');
  }

  return userId;
};
