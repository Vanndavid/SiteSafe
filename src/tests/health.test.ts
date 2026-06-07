/// <reference types="jest" />
import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';

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
