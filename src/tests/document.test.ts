import request from 'supertest';
import app from '../server';
import { bearerAuthHeader } from './helpers/auth';

jest.mock('../services/documentService', () => ({
  createUploadIntent: jest.fn(),
}));

import { createUploadIntent } from '../services/documentService';

const mockedCreateUploadIntent =
  createUploadIntent as jest.MockedFunction<typeof createUploadIntent>;

describe('POST /api/documents/upload-url', () => {
  it('returns upload url for valid request', async () => {
    mockedCreateUploadIntent.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      key: 'uploads/test_user_123/doc-1-file.pdf',
      uploadUrl: 'https://example.com/upload',
      expiresIn: 300,
    });

    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        projectId: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.documentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(res.body.uploadUrl).toBeDefined();
    expect(mockedCreateUploadIntent).toHaveBeenCalledWith(
      'test_user_123',
      1,
      'file.pdf',
      'application/pdf',
    );
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

    expect(res.status).toBe(401);
  });

  it('rejects upload without projectId', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('projectId is required');
  });

  it('rejects unsupported file type', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.exe',
        mimeType: 'application/x-msdownload',
        projectId: 1,
      });

    expect(res.status).toBe(400);
  });

  it('returns 500 when service fails', async () => {
    mockedCreateUploadIntent.mockRejectedValue(
      new Error('service failure')
    );

    const res = await request(app)
      .post('/api/documents/upload-url')
      .set(bearerAuthHeader())
      .send({
        fileName: 'file.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        projectId: 1,
      });

    expect(res.status).toBe(500);
  });
});
