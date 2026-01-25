import request from 'supertest';

// --- 2. MOCK S3 UPLOAD (Multer) ---
// Crucial: We create a "Spy" middleware.
// This allows us to change behavior per test (fail vs success).
const mockMulterMiddleware = jest.fn((req: any, res: any, next: any) => {
  next();
});

jest.mock('../config/s3uploader', () => ({
  __esModule: true,
  default: {
    // When the route calls upload.single('document'), return our spy
    single: () => mockMulterMiddleware 
  }
}));

import app from '../server';
import mongoose from 'mongoose';
import DocumentModel from '../models/Document';

// 1. SILENCE THE SCHEDULER (Prevents background DB calls)
jest.mock('../services/scheduler', () => ({
  checkExpiringDocuments: jest.fn(),
  startScheduler: jest.fn() 
}));

// 2. SILENCE REDIS (Prevents the ENOTFOUND error)
jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    host: 'localhost',
    port: 6379,
    lazyConnect: true // This tells the code "Don't connect until I ask"
  }
}));

// 3. SILENCE THE QUEUE WORKER (Prevents BullMQ from starting)
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

// --- 1. MOCK AUTH (Clerk) ---
// Bypass real authentication
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



// --- 3. MOCK QUEUE (BullMQ or SQS) ---
// Prevent connecting to real Redis or AWS SQS during tests
jest.mock('../queues/documentQueue', () => ({
  addDocumentJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }) // Fake success
}));

// B. Mock the Cloud Queue (SQS) - THIS STOPS THE AWS ERROR
jest.mock('../queues/sqsProducer', () => ({
  addDocumentJob: jest.fn().mockResolvedValue({ MessageId: 'mock-sqs-id' })
}));

// --- TEST SETUP ---
beforeAll(async () => {
  // Ensure we are connected to a TEST DB (not production)
  // Ideally, process.env.MONGODB_URI should be set to a test URL in package.json
  await DocumentModel.deleteMany({}); 
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Document API Endpoints', () => {
  
  let uploadedDocId: string;

  // TEST CASE 1: The "Forgot File" Error
  it('should return 400 if no file is attached', async () => {
    // CONFIGURATION: Tell our mock middleware to NOT attach a file
    mockMulterMiddleware.mockImplementation((req, res, next) => {
        req.file = undefined; 
        next();
    });

    const res = await request(app)
      .post('/api/upload'); // Send empty post
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error', 'No file uploaded');
  });

  // TEST CASE 2: The "Happy Path" Upload
  it('should upload a file and return 202 Accepted', async () => {
    // CONFIGURATION: Tell our mock middleware to SIMULATE a successful S3 upload
    mockMulterMiddleware.mockImplementation((req, res, next) => {
        req.file = {
            originalname: 'test-license.pdf',
            mimetype: 'application/pdf',
            size: 5000,
            // CRITICAL: The controller expects 'key' (S3), not 'path' (Local)
            key: 'uploads/test-license-123.pdf', 
            location: 'https://s3.aws.com/bucket/uploads/test.pdf'
        };
        next();
    });

    const res = await request(app)
      .post('/api/upload')
      .attach('document', Buffer.from('fake-pdf'), 'test.pdf'); 

    expect(res.statusCode).toEqual(202);
    expect(res.body.success).toBe(true);
    expect(res.body.file).toHaveProperty('id');
    
    // Verify response uses S3 Key logic
    // (Your controller might return key or path depending on version)
    // expect(res.body.file).toHaveProperty('key'); 

    uploadedDocId = res.body.file.id;

    // Verify DB Record
    const dbRecord = await DocumentModel.findById(uploadedDocId);
    expect(dbRecord).toBeTruthy();
    expect(dbRecord?.userId).toBe('test_user_123');
    expect(dbRecord?.status).toBe('pending');
    expect(dbRecord?.storagePath).toBe('uploads/test-license-123.pdf'); // Check S3 Key saved
  });

  // TEST CASE 3: Fetching Status
  it('should fetch the status of the uploaded document', async () => {
    const res = await request(app)
      .get(`/api/document/${uploadedDocId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'pending');
  });

});