import jwt, { type SignOptions } from 'jsonwebtoken';

export type AccessTokenPayload = {
  userId: string;
  email: string;
};

export type RefreshTokenPayload = AccessTokenPayload & {
  tokenId: string;
};

export const refreshCookieName = 'refreshToken';

const accessTokenTtl = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const refreshTokenTtl = process.env.JWT_REFRESH_TOKEN_TTL || '7d';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'dev_jwt_secret_change_me';
};

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: accessTokenTtl } as SignOptions);

export const signRefreshToken = (payload: RefreshTokenPayload) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: refreshTokenTtl } as SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, getJwtSecret()) as AccessTokenPayload;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, getJwtSecret()) as RefreshTokenPayload;
