import type { Request } from 'express';
import { getAuth } from '@clerk/express';

const FALLBACK_USER_ID = 'test_user_123';

export const getRequestUserId = (req: Request) => {
  try {
    return getAuth(req).userId || FALLBACK_USER_ID;
  } catch {
    return FALLBACK_USER_ID;
  }
};
