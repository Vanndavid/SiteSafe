import request from 'supertest';

const mockDocuments: any[] = [];
let mockIdCounter = 1;

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  document: {
    create: jest.fn(({ data }) => {
      const doc = {
        id: data.id || `doc_${mockIdCounter++}`,
        uploadDate: new Date(),
        extractedData: null,
        ...data,
        status: data.status || 'pending',
      };
      mockDocuments.push(doc);
      return Promise.resolve(doc);
    }),
    findUnique: jest.fn(({ where }) => {
      return Promise.resolve(mockDocuments.find(doc => doc.id === where.id) || null);
    }),
    findMany: jest.fn(({ where, orderBy, take } = {}) => {
      let docs = [...mockDocuments];
      if (where?.status) {
        docs = docs.filter(doc => doc.status === where.status);
      }
      if (orderBy?.uploadDate === 'desc') {
        docs.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
      }
      return Promise.resolve(typeof take === 'number' ? docs.slice(0, take) : docs);
    }),
    update: jest.fn(({ where, data }) => {
      const index = mockDocuments.findIndex(doc => doc.id === where.id);
      if (index === -1) {
        throw new Error(`Document not found: ${where.id}`);
      }
      mockDocuments[index] = {
        ...mockDocuments[index],
        ...data,
      };
      return Promise.resolve(mockDocuments[index]);
    }),
    deleteMany: jest.fn(() => {
      mockDocuments.length = 0;
      mockIdCounter = 1;
      return Promise.resolve({ count: 0 });
    }),
  },
  notification: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  },
};

jest.mock('../config/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://s3.example.com/presigned-upload-url');

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

const mockMulterMiddleware = jest.fn((req: any, res: any, next: any) => {
  next();
});

jest.mock('../config/s3uploader', () => ({
  __esModule: true,
  default: {
    single: () => mockMulterMiddleware 
  }
}));

import app from '../server';
import { addDocumentJob } from '../queues/sqsProducer';

jest.mock('../services/scheduler', () => ({
  checkExpiringDocuments: jest.fn(),
  startScheduler: jest.fn() 
}));

jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    host: 'localhost',
    port: 6379,
    lazyConnect: true
  }
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, res: any, next: any) => {
    req.auth = { userId: 'test_user_123' };
    next();
  },
  requireAuth: () => (req: any, res: any, next: any) => {
    req.auth = { userId: 'test_user_123' };
    next();
  },
  getAuth: () => ({ userId: 'test_user_123' }),
}));

jest.mock('../queues/documentQueue', () => ({
  addDocumentJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' })
}));

jest.mock('../queues/sqsProducer', () => ({
  addDocumentJob: jest.fn().mockResolvedValue({ MessageId: 'mock-sqs-id' })
}));

beforeAll(async () => {
  await mockPrisma.document.deleteMany();
});

afterAll(async () => {
  await mockPrisma.$disconnect();
});

describe('Document API Endpoints', () => {
  beforeEach(() => {
    void mockPrisma.document.deleteMany();
    mockS3Send.mockReset();
    mockGetSignedUrl.mockClear();
  });

  it('should create a direct S3 upload URL and reserve a document', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .send({
        fileName: 'direct-license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 5000,
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toMatchObject({
      uploadUrl: 'https://s3.example.com/presigned-upload-url',
      expiresIn: 300,
    });
    expect(res.body.documentId).toEqual(expect.any(String));
    expect(res.body.key).toContain(`uploads/test_user_123/${res.body.documentId}-direct-license.pdf`);
    expect(mockGetSignedUrl).toHaveBeenCalled();

    const dbRecord = await mockPrisma.document.findUnique({ where: { id: res.body.documentId } });
    expect(dbRecord).toBeTruthy();
    expect(dbRecord?.userId).toBe('test_user_123');
    expect(String(dbRecord?.status)).toBe('uploading');
    expect(dbRecord?.storagePath).toBe(res.body.key);
  });

  it('should reject unsupported direct upload file types', async () => {
    const res = await request(app)
      .post('/api/documents/upload-url')
      .send({
        fileName: 'script.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 5000,
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'Unsupported file type');
    expect(mockGetSignedUrl).not.toHaveBeenCalled();
  });

  it('should complete a direct S3 upload and queue processing', async () => {
    mockS3Send.mockResolvedValueOnce({
      ContentType: 'application/pdf',
      ContentLength: 5000,
    });

    const doc = await mockPrisma.document.create({
      data: {
        originalName: 'completed-direct-license.pdf',
        storagePath: 'uploads/test_user_123/completed-direct-license.pdf',
        mimeType: 'application/pdf',
        status: 'uploading' as any,
        userId: 'test_user_123',
      },
    });

    const res = await request(app)
      .post(`/api/documents/${doc.id}/complete-upload`);

    expect(res.statusCode).toEqual(202);
    expect(res.body.success).toBe(true);
    expect(res.body.file).toMatchObject({
      id: doc.id,
      originalName: 'completed-direct-license.pdf',
      status: 'pending',
      key: 'uploads/test_user_123/completed-direct-license.pdf',
    });

    const dbRecord = await mockPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbRecord?.status).toBe('pending');
    expect(mockS3Send).toHaveBeenCalled();
    expect(addDocumentJob).toHaveBeenCalledWith(
      doc.id,
      'uploads/test_user_123/completed-direct-license.pdf',
      'application/pdf'
    );
  });
});
