import { signAccessToken } from '../../utils/jwtUtils';

export const TEST_USER_ID = 'test_user_123';
export const TEST_USER_EMAIL = 'test@example.com';

export const createTestAccessToken = (overrides?: Partial<{ userId: string; email: string }>) =>
  signAccessToken({
    userId: overrides?.userId ?? TEST_USER_ID,
    email: overrides?.email ?? TEST_USER_EMAIL,
  });

export const bearerAuthHeader = (token?: string) => ({
  Authorization: `Bearer ${token ?? createTestAccessToken()}`,
});
