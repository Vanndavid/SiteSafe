import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { parsePositiveIntEnv } from '../utils/envUtils';

const isRateLimitDisabled = () =>
  process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

const authenticatedKey = (req: Request) =>
  req.auth?.userId
    ? `user:${req.auth.userId}`
    : `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown')}`;

const createLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isRateLimitDisabled(),
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
    message: { error: options.message },
  });

export const authRateLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: parsePositiveIntEnv(process.env.AUTH_RATE_LIMIT_MAX, 30),
  message: 'Too many authentication attempts. Please try again later.',
});

export const uploadRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: parsePositiveIntEnv(process.env.UPLOAD_RATE_LIMIT_MAX, 40),
  keyGenerator: authenticatedKey,
  message: 'Upload requests are temporarily rate limited. Please retry later.',
});

export const workerCallbackRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: parsePositiveIntEnv(process.env.WORKER_CALLBACK_RATE_LIMIT_MAX, 300),
  message: 'Worker callback rate limit exceeded.',
});
