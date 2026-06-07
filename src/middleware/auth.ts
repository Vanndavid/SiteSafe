import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwtUtils';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = verifyAccessToken(token);
    req.auth = { userId: decoded.userId, email: decoded.email };
    return next();
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }
};
