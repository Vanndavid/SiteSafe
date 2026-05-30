/// <reference types="jest" />
import request from 'supertest';
import app from '../server'; // Import your Express App
import prisma from '../config/prisma';

// Without this, the real Clerk middleware runs with a fake key and crashes the server.
jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, res: any, next: any) => next(), // Pass through
  requireAuth: () => (req: any, res: any, next: any) => next(),
  getAuth: () => ({ userId: 'test_user' })
}));

// Close DB connection after tests
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/health', () => {
  it('should return 200 OK and status active', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'active');
  });
});
