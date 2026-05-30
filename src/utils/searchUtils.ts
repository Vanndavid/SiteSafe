import type { ExtractedDocumentData } from '../models/Document';

const SEARCH_STOP_WORDS = new Set([
  'a', 'about', 'all', 'an', 'and', 'are', 'be', 'by', 'documents', 'document', 'expire', 'expired', 'expiring',
  'files', 'find', 'for', 'from', 'in', 'is', 'me', 'month', 'months', 'of', 'show', 'that', 'the', 'their',
  'to', 'uploaded', 'user', 'with', 'within',
]);

export const normalizeSearchText = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeSearchTerms = (query: string) => {
  const matches = normalizeSearchText(query).match(/[a-z0-9]+/g) || [];
  return Array.from(new Set(matches.filter(token => token.length > 1 && !SEARCH_STOP_WORDS.has(token))));
};

export const extractExpiryWindowDays = (query: string) => {
  const normalized = normalizeSearchText(query);
  const match = normalized.match(/(?:expire|expired|expiring)(?:d)?(?:\s+\w+){0,3}?\s+(?:in|within|before)\s+(\d+)\s+(day|days|week|weeks|month|months)/i);

  if (!match) {
    return null;
  }

  const [, amountRaw, unitRaw] = match;
  const amount = Number(amountRaw);
  const unit = unitRaw?.toLowerCase();

  if (!amountRaw || !unit || Number.isNaN(amount) || amount < 0) {
    return null;
  }

  if (unit.startsWith('day')) return amount;
  if (unit.startsWith('week')) return amount * 7;
  if (unit.startsWith('month')) return amount * 30;
  return null;
};

export const buildDocumentSearchSummary = (doc: { originalName: string; extractedData?: ExtractedDocumentData | null }) => {
  const parts = [
    doc.originalName,
    doc.extractedData?.docType,
    doc.extractedData?.holderName,
    doc.extractedData?.licenseNumber,
    doc.extractedData?.content,
  ].filter(Boolean);

  return normalizeSearchText(parts.join(' '));
};
