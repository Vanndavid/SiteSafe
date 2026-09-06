import request from 'supertest';
import app from '../server';
import { bearerAuthHeader } from './helpers/auth';

jest.mock('../config/prisma', () => ({
  __esModule: true,
  default: {
    document: { findFirst: jest.fn() },
  },
}));

jest.mock('../services/storageService', () => ({
  generatePresignedDownloadUrl: jest.fn(),
  getObjectHead: jest.fn(),
}));

import prisma from '../config/prisma';
import { generatePresignedDownloadUrl } from '../services/storageService';

const mockedFindFirst = prisma.document.findFirst as jest.MockedFunction<
  typeof prisma.document.findFirst
>;
const mockedPresign = generatePresignedDownloadUrl as jest.MockedFunction<
  typeof generatePresignedDownloadUrl
>;

const STORAGE_KEY = 'uploads/test_user_123/9f1c-White Card.pdf';

describe('GET /api/download/*key', () => {
  beforeEach(() => {
    mockedFindFirst.mockResolvedValue({ id: 'doc-1' } as never);
    mockedPresign.mockResolvedValue('https://s3.example.com/signed');
  });

  // Express 5 returns a wildcard param as an array of decoded segments. Passing
  // that straight to the AWS SDK does not coerce to a string - the SDK
  // JSON-stringifies it, producing a key like ["uploads/..."] that resolves to
  // no object at all.
  it('rebuilds the storage key as a string, not an array', async () => {
    const res = await request(app)
      .get(`/api/download/${encodeURIComponent(STORAGE_KEY)}`)
      .set(bearerAuthHeader());

    expect(res.status).toBe(200);

    const passedKey = mockedPresign.mock.calls[0]![0];
    expect(typeof passedKey).toBe('string');
    expect(passedKey).toBe(STORAGE_KEY);
  });

  it('rebuilds a key sent as separate path segments', async () => {
    const res = await request(app)
      .get('/api/download/uploads/test_user_123/report.pdf')
      .set(bearerAuthHeader());

    expect(res.status).toBe(200);
    expect(mockedPresign).toHaveBeenCalledWith('uploads/test_user_123/report.pdf');
  });

  it('returns the signed url', async () => {
    const res = await request(app)
      .get(`/api/download/${encodeURIComponent(STORAGE_KEY)}`)
      .set(bearerAuthHeader());

    expect(res.body.url).toBe('https://s3.example.com/signed');
  });

  it('will not sign a url for a document the user does not own', async () => {
    mockedFindFirst.mockResolvedValue(null as never);

    const res = await request(app)
      .get(`/api/download/${encodeURIComponent('uploads/someone_else/secret.pdf')}`)
      .set(bearerAuthHeader());

    expect(res.status).toBe(404);
    expect(mockedPresign).not.toHaveBeenCalled();
  });

  it('scopes the ownership lookup to the authenticated user', async () => {
    await request(app)
      .get(`/api/download/${encodeURIComponent(STORAGE_KEY)}`)
      .set(bearerAuthHeader());

    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storagePath: STORAGE_KEY, userId: 'test_user_123' },
      }),
    );
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/api/download/${encodeURIComponent(STORAGE_KEY)}`);

    expect(res.status).toBe(401);
    expect(mockedPresign).not.toHaveBeenCalled();
  });
});
