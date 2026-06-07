import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/prisma';
import {
  refreshCookieName,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwtUtils';
import {
  deleteRefreshToken,
  getRefreshTokenUserId,
  storeRefreshToken,
} from '../utils/refreshTokenStore';

const getRefreshTokenFromRequest = (req: Request) => {
  const cookieToken = req.cookies?.[refreshCookieName];

  if (typeof cookieToken === 'string') {
    return cookieToken;
  }

  return typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
  });
};

const createTokens = (user: { id: string; email: string }) => {
  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email, tokenId });

  storeRefreshToken(tokenId, user.id);

  return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const loginEmail = String(email || username || '').trim().toLowerCase();

    if (!loginEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = createTokens(user);
    setRefreshCookie(res, tokens.refreshToken);

    return res.status(200).json({
      accessToken: tokens.accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Error occurred while logging in:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        deleteRefreshToken(decoded.tokenId);
      } catch {
        // Expired or malformed refresh tokens are already unusable.
      }
    }

    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error occurred while logging out:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, username, password } = req.body;
    const userEmail = String(email || username || '').trim().toLowerCase();
    const userName = String(name || username || userEmail.split('@')[0] || '').trim();

    if (!userEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: userName,
        email: userEmail,
        password: passwordHash,
      },
    });

    const tokens = createTokens(user);
    setRefreshCookie(res, tokens.refreshToken);

    return res.status(201).json({
      accessToken: tokens.accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('Error occurred while registering:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const storedUserId = getRefreshTokenUserId(decoded.tokenId);

    if (!storedUserId || storedUserId !== decoded.userId) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    deleteRefreshToken(decoded.tokenId);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = createTokens(user);
    setRefreshCookie(res, tokens.refreshToken);

    return res.status(200).json({
      accessToken: tokens.accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    clearRefreshCookie(res);
    console.error('Error occurred while refreshing token:', error);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const me = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user: { id: user.id, name: user.name, email: user.email } });
};
