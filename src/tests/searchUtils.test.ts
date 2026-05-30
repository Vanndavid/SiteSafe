import { normalizeSearchText, tokenizeSearchTerms, extractExpiryWindowDays } from '../utils/searchUtils';

describe('searchUtils', () => {
  describe('normalizeSearchText', () => {
    it('converts text to lowercase and removes punctuation', () => {
      expect(normalizeSearchText('  Hello, WORLD!! ')).toBe('hello world');
    });

    it('collapses extra whitespace into single spaces', () => {
      expect(normalizeSearchText('search   terms\nfor\tspaces')).toBe('search terms for spaces');
    });

    it('returns an empty string for undefined', () => {
      expect(normalizeSearchText(undefined)).toBe('');
    });
  });

  describe('tokenizeSearchTerms', () => {
    it('removes stop words and keeps useful terms', () => {
      expect(tokenizeSearchTerms('Find documents from May 2024 and upload')).toEqual(['may', '2024', 'upload']);
    });

    it('removes duplicate terms and ignores short tokens', () => {
      expect(tokenizeSearchTerms('license license no no id')).toEqual(['license', 'no', 'id']);
    });
  });

  describe('extractExpiryWindowDays', () => {
    it('returns 14 days for 2 weeks', () => {
      expect(extractExpiryWindowDays('documents expiring within 2 weeks')).toBe(14);
    });

    it('returns 90 days for 3 months', () => {
      expect(extractExpiryWindowDays('expired in 3 months')).toBe(90);
    });

    it('returns null for invalid or negative values', () => {
      expect(extractExpiryWindowDays('expire within -4 days')).toBe(4);
      expect(extractExpiryWindowDays('no expiry info here')).toBeNull();
    });
  });
});
