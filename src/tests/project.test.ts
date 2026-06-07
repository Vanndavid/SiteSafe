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
    project: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

import app from '../server';
import prisma from '../config/prisma';
import { bearerAuthHeader } from './helpers/auth';

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedFindMany = mockedPrisma.project.findMany as jest.Mock;
const mockedCreate = mockedPrisma.project.create as jest.Mock;

describe('Project API Endpoints', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test_jwt_secret';
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('returns projects for authenticated user', async () => {
      mockedFindMany.mockResolvedValue([
        { id: 1, name: 'Compliance', description: null },
      ]);

      const res = await request(app)
        .get('/api/projects')
        .set(bearerAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.projects[0].name).toBe('Compliance');
      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'test_user_123' },
        }),
      );
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/projects', () => {
    it('creates a project with valid name', async () => {
      mockedCreate.mockResolvedValue({
        id: 2,
        name: 'New Project',
        description: null,
      });

      const res = await request(app)
        .post('/api/projects')
        .set(bearerAuthHeader())
        .send({ name: 'New Project' });

      expect(res.status).toBe(201);
      expect(res.body.project.name).toBe('New Project');
      expect(mockedCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Project',
            userId: 'test_user_123',
          }),
        }),
      );
    });

    it('rejects empty project name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set(bearerAuthHeader())
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Project name is required');
    });
  });
});
