import { randomUUID } from 'crypto';
import { addDocumentJob } from '../queues/sqsProducer';
import prisma from '../config/prisma';
import { createSignedUploadUrl } from './storageService';
import { buildDocumentSearchSummary, extractExpiryWindowDays, tokenizeSearchTerms } from '../utils/searchUtils';
import { daysUntilExpiry } from '../utils/dateUtils';
import { sanitizeFileName } from '../utils/fileUtils';
import type { Document } from '@prisma/client';
import type { ExtractedDocumentData } from '../models/Document';

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;
const MAX_OVERVIEW_RECORDS = 500;

export type UploadedFileData = {
  originalname: string;
  key: string;
  mimetype: string;
};

export const createPendingDocumentRecord = async (fileData: UploadedFileData, userId: string) => {
  const newDoc = await prisma.document.create({
    data: {
      originalName: fileData.originalname,
      storagePath: fileData.key,
      mimeType: fileData.mimetype,
      status: 'pending',
      userId,
    },
  });

  if (typeof addDocumentJob === 'function') {
    await addDocumentJob(newDoc.id as unknown as string, newDoc.storagePath, newDoc.mimeType);
  }

  return newDoc;
};

export const createUploadIntent = async (userId: string, fileName: string, mimeType: string) => {
  const documentId = randomUUID();
  const safeFileName = sanitizeFileName(fileName);
  const key = `uploads/${userId}/${documentId}-${safeFileName}`;

  await prisma.document.create({
    data: {
      id: documentId,
      originalName: fileName,
      storagePath: key,
      mimeType,
      status: 'uploading',
      userId,
    },
  });

  const uploadUrl = await createSignedUploadUrl(
    key,
    mimeType,
    {
      documentId,
      userId,
      originalName: safeFileName,
    },
    UPLOAD_URL_EXPIRY_SECONDS,
  );

  return {
    documentId,
    key,
    uploadUrl,
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  };
};

export const markDocumentPendingAndQueue = async (document: Document) => {
  const updatedDoc = await prisma.document.update({
    where: { id: document.id },
    data: { status: 'pending' },
  });

  if (typeof addDocumentJob === 'function') {
    await addDocumentJob(updatedDoc.id as unknown as string, updatedDoc.storagePath, updatedDoc.mimeType);
  }

  return updatedDoc;
};

export const getAllDocuments = async () => {
  const docs = await prisma.document.findMany({
    orderBy: { uploadDate: 'desc' },
    take: 20,
  });

  return docs.map(doc => ({
    id: doc.id,
    name: doc.originalName,
    status: doc.status,
    storagePath: doc.storagePath,
    extraction: doc.extractedData,
  }));
};

export const getDocumentStatusById = async (id: string) => {
  return prisma.document.findUnique({
    where: { id },
  });
};

export const getDocumentOverview = async (expiringWithinDays: number, limit: number) => {
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      originalName: true,
      status: true,
      extractedData: true,
    },
    orderBy: { uploadDate: 'desc' },
    take: MAX_OVERVIEW_RECORDS,
  });

  const totals = {
    total: docs.length,
    pending: 0,
    processed: 0,
    failed: 0,
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    missingExpiry: 0,
  };

  const expiringDocuments: Array<{ id: string; name: string; expiryDate?: string; daysUntilExpiry: number; status: string }> = [];

  docs.forEach(doc => {
    if (doc.status === 'pending') totals.pending += 1;
    if (doc.status === 'processed') totals.processed += 1;
    if (doc.status === 'failed') totals.failed += 1;

    const expiryInDays = daysUntilExpiry((doc.extractedData as ExtractedDocumentData | null)?.expiryDate);

    if (expiryInDays == null) {
      totals.missingExpiry += 1;
      return;
    }

    if (expiryInDays < 0) {
      totals.expired += 1;
      return;
    }

    if (expiryInDays <= expiringWithinDays) {
      totals.expiringSoon += 1;
      expiringDocuments.push({
        id: doc.id,
        name: doc.originalName,
        expiryDate: (doc.extractedData as ExtractedDocumentData | null)?.expiryDate,
        daysUntilExpiry: expiryInDays,
        status: doc.status,
      });
      return;
    }

    totals.valid += 1;
  });

  expiringDocuments.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return {
    generatedAt: new Date().toISOString(),
    filters: { expiringWithinDays },
    totals,
    expiringDocuments: expiringDocuments.slice(0, limit),
  };
};

export const searchProcessedDocuments = async (query: string) => {
  const keywordTerms = tokenizeSearchTerms(query);
  const expiryWindowDays = extractExpiryWindowDays(query);

  const docs = await prisma.document.findMany({
    where: { status: 'processed' },
    orderBy: { uploadDate: 'desc' },
    take: 100,
  });

  const results = docs
    .map(doc => {
      const haystack = buildDocumentSearchSummary(doc);
      const matchedTerms = keywordTerms.filter(term => haystack.includes(term));
      const expiryInDays = daysUntilExpiry((doc.extractedData as ExtractedDocumentData | null)?.expiryDate);
      const matchesExpiryWindow = expiryWindowDays == null
        ? true
        : expiryInDays != null && expiryInDays >= 0 && expiryInDays <= expiryWindowDays;

      const keywordMatchRequired = keywordTerms.length === 0 || matchedTerms.length > 0;
      if (!keywordMatchRequired || !matchesExpiryWindow) {
        return null;
      }

      const reasons: string[] = [];
      if (matchedTerms.length > 0) {
        reasons.push(`Matched ${matchedTerms.join(', ')}`);
      }
      if (expiryWindowDays != null && expiryInDays != null) {
        reasons.push(`Expires in ${expiryInDays} day${expiryInDays === 1 ? '' : 's'}`);
      }

      return {
        id: doc.id,
        name: doc.originalName,
        status: doc.status,
        storagePath: doc.storagePath,
        extraction: doc.extractedData,
        matchReasons: reasons,
        score: matchedTerms.length + (matchesExpiryWindow && expiryWindowDays != null ? 2 : 0),
      };
    })
    .filter((doc): doc is { id: string; name: string; status: string; storagePath: string; extraction: ExtractedDocumentData | null; matchReasons: string[]; score: number } => doc !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...doc }) => doc);

  return {
    query,
    interpretedFilters: {
      keywords: keywordTerms,
      expiryWithinDays: expiryWindowDays,
    },
    results,
  };
};

export const updateDocumentProcessingResult = async (
  id: string,
  status: 'processed' | 'failed',
  extractedData?: ExtractedDocumentData,
) => {
  const data = status === 'processed'
    ? { status, extractedData: extractedData || {} }
    : { status };

  return prisma.document.update({
    where: { id },
    data,
  });
};
