import bcrypt from 'bcrypt';
import request from 'supertest';

jest.mock('../config/db', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../services/scheduler', () => ({
  startScheduler: jest.fn(),
}));

jest.mock('../config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import app from '../server';
import prisma from '../config/prisma';
import { bearerAuthHeader, createTestAccessToken } from './helpers/auth';
import { clearRefreshTokenStore } from '../utils/refreshTokenStore';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const testUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
};

const mockedFindUnique = mockedPrisma.user.findUnique as jest.Mock;
const mockedCreate = mockedPrisma.user.create as jest.Mock;

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test_jwt_secret';
    clearRefreshTokenStore();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('creates a user and returns an access token', async () => {
      mockedFindUnique.mockResolvedValue(null);
      mockedCreate.mockResolvedValue(testUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toEqual({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
      });
      expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);
    });

    it('rejects duplicate email registrations', async () => {
      mockedFindUnique.mockResolvedValue(testUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns an access token for valid credentials', async () => {
      mockedFindUnique.mockResolvedValue(testUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('rejects invalid credentials', async () => {
      mockedFindUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user profile', async () => {
      mockedFindUnique.mockResolvedValue(testUser);

      const res = await request(app)
        .get('/api/auth/me')
        .set(bearerAuthHeader(createTestAccessToken({ userId: testUser.id, email: testUser.email })));

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
      });
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns a new access token when refresh cookie is valid', async () => {
      mockedFindUnique.mockResolvedValue(testUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      const refreshCookie = loginRes.headers['set-cookie']?.[0];
      expect(refreshCookie).toBeDefined();

      mockedFindUnique.mockResolvedValue(testUser);

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie!);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.user.email).toBe(testUser.email);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the refresh cookie', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=;/);
    });
  });
});
