import { daysUntilExpiry } from '../utils/dateUtils';

describe('dateUtils', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-30T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns 30 days for a date 30 days in the future', () => {
    expect(daysUntilExpiry('2026-06-29T00:00:00Z')).toBe(30);
  });

  it('returns a negative or zero number for a past date', () => {
    expect(daysUntilExpiry('2026-05-01T00:00:00Z')).toBeLessThanOrEqual(0);
  });

  it('returns null for an invalid date string', () => {
    expect(daysUntilExpiry('not-a-date')).toBeNull();
  });

  it('returns null for undefined and null values', () => {
    expect(daysUntilExpiry(undefined)).toBeNull();
    expect(daysUntilExpiry(null as unknown as string)).toBeNull();
  });
});
