import request from 'supertest';

const mockConnectDb = jest.fn();
const mockStartScheduler = jest.fn();

jest.mock('../config/db', () => ({
  __esModule: true,
  default: () => mockConnectDb(),
}));

jest.mock('../services/scheduler', () => ({
  startScheduler: () => mockStartScheduler(),
}));

jest.mock('../config/s3uploader', () => ({
  __esModule: true,
  default: {
    single: () => (req: unknown, res: unknown, next: () => void) => next(),
  },
}));

import app from '../server';
import { bearerAuthHeader, createTestAccessToken } from './helpers/auth';

describe('Billing API Endpoints', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID = 'price_123';
    process.env.JWT_SECRET = 'test_jwt_secret';
    (global as typeof globalThis & { fetch: typeof mockFetch }).fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('should reject checkout creation when the user is not authenticated', async () => {
    const res = await request(app).post('/api/billing/checkout');

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error', 'Authentication required');
  });

  it('should create a Stripe checkout session and return its URL', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }),
      ok: true,
    });

    const res = await request(app)
      .post('/api/billing/checkout')
      .set(bearerAuthHeader(createTestAccessToken({ userId: 'user_billing_123', email: 'billing@example.com' })))
      .set('Origin', 'http://localhost:5173');

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('url', 'https://checkout.stripe.com/pay/cs_test_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/checkout/sessions',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
