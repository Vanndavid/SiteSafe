import { NextFunction, Request, Response } from 'express';
import { verifyCaptchaToken } from '../services/captchaService';

const extractCaptchaToken = (req: Request) => {
  if (typeof req.body?.captchaToken === 'string') {
    return req.body.captchaToken;
  }

  const headerToken = req.header('x-captcha-token');
  return typeof headerToken === 'string' ? headerToken : undefined;
};

export const requireCaptcha = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractCaptchaToken(req);
  const remoteIp = req.ip || req.socket.remoteAddress;
  const result = await verifyCaptchaToken(token, remoteIp);

  if (!result.success) {
    return res.status(403).json({ error: result.reason || 'Captcha validation failed' });
  }

  return next();
};
