import type { Document } from '@prisma/client';

export type IDocument = Document;

export type ExtractedDocumentData = {
  docType?: string;
  expiryDate?: string;
  licenseNumber?: string;
  holderName?: string;
  confidence?: number;
  content?: string;
};