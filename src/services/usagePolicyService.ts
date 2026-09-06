import { DocumentStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { parseBooleanEnv, parseCsvEnv, parsePositiveIntEnv } from '../utils/envUtils';
import { HttpError } from '../utils/httpError';

const FREE_DAILY_GEMINI_LIMIT = parsePositiveIntEnv(process.env.FREE_DAILY_GEMINI_LIMIT, 25);
const PAID_DAILY_GEMINI_LIMIT = parsePositiveIntEnv(process.env.PAID_DAILY_GEMINI_LIMIT, 300);
const MAX_PENDING_DOCUMENTS_PER_USER = parsePositiveIntEnv(process.env.MAX_PENDING_DOCUMENTS_PER_USER, 10);
const MAX_DAILY_UPLOAD_INTENTS_PER_USER = parsePositiveIntEnv(process.env.MAX_DAILY_UPLOAD_INTENTS_PER_USER, 60);
const REQUIRE_PAID_PLAN_FOR_GEMINI = parseBooleanEnv(process.env.REQUIRE_PAID_PLAN_FOR_GEMINI, false);

const paidUserIds = parseCsvEnv(process.env.PAID_USER_IDS);
const paidUserEmails = parseCsvEnv(process.env.PAID_USER_EMAILS);
const blockedUserIds = parseCsvEnv(process.env.BLOCKED_USER_IDS);
const blockedUserEmails = parseCsvEnv(process.env.BLOCKED_USER_EMAILS);

const getStartOfUtcDay = () => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start;
};

const normalizeEmail = (email: string | null | undefined) => (email || '').trim().toLowerCase();

const resolveUserEmail = async (userId: string, email?: string) => {
  if (email) {
    return normalizeEmail(email);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return normalizeEmail(user?.email);
};

const isPaidUser = (userId: string, email: string) =>
  paidUserIds.has(userId) || (email.length > 0 && paidUserEmails.has(email));

const isBlockedUser = (userId: string, email: string) =>
  blockedUserIds.has(userId) || (email.length > 0 && blockedUserEmails.has(email));

export const enforceUploadIntentPolicy = async (userId: string, userEmail?: string) => {
  const email = await resolveUserEmail(userId, userEmail);
  if (isBlockedUser(userId, email)) {
    throw new HttpError(403, 'Your account is not allowed to upload documents.');
  }

  const createdToday = await prisma.document.count({
    where: {
      userId,
      uploadDate: {
        gte: getStartOfUtcDay(),
      },
    },
  });

  if (createdToday >= MAX_DAILY_UPLOAD_INTENTS_PER_USER) {
    throw new HttpError(
      429,
      'Daily upload limit reached. Please try again tomorrow or contact support.',
    );
  }
};

/**
 * Gate for question answering.
 *
 * Mirrors the blocked-user and paid-plan checks in enforceGeminiQueuePolicy so
 * that asking questions cannot be used to reach Gemini by an account that is
 * barred from document processing.
 *
 * It deliberately does not apply the daily counters: those count Document rows,
 * and asking a question creates none. Volume on this route is bounded by
 * askRateLimiter instead. A true per-day question quota would need its own
 * counter, which is not built.
 */
export const enforceAskPolicy = async (userId: string, userEmail?: string) => {
  const email = await resolveUserEmail(userId, userEmail);

  if (isBlockedUser(userId, email)) {
    throw new HttpError(403, 'Your account is not allowed to use AI features.');
  }

  if (REQUIRE_PAID_PLAN_FOR_GEMINI && !isPaidUser(userId, email)) {
    throw new HttpError(
      403,
      'AI features are currently restricted to paid accounts. Please contact support.',
    );
  }
};

export const enforceGeminiQueuePolicy = async (userId: string, userEmail?: string) => {
  const email = await resolveUserEmail(userId, userEmail);
  if (isBlockedUser(userId, email)) {
    throw new HttpError(403, 'Your account is not allowed to process AI documents.');
  }

  const paidUser = isPaidUser(userId, email);

  if (REQUIRE_PAID_PLAN_FOR_GEMINI && !paidUser) {
    throw new HttpError(
      403,
      'AI processing is currently restricted to paid accounts. Please contact support.',
    );
  }

  const pendingCount = await prisma.document.count({
    where: {
      userId,
      status: DocumentStatus.pending,
    },
  });

  if (pendingCount >= MAX_PENDING_DOCUMENTS_PER_USER) {
    throw new HttpError(
      429,
      'Too many pending AI jobs. Wait for current files to finish processing before uploading more.',
    );
  }

  const geminiAttemptsToday = await prisma.document.count({
    where: {
      userId,
      uploadDate: {
        gte: getStartOfUtcDay(),
      },
      status: {
        in: [DocumentStatus.pending, DocumentStatus.processed, DocumentStatus.failed],
      },
    },
  });

  const dailyLimit = paidUser ? PAID_DAILY_GEMINI_LIMIT : FREE_DAILY_GEMINI_LIMIT;
  if (geminiAttemptsToday >= dailyLimit) {
    throw new HttpError(
      429,
      'Daily AI processing quota reached. Please try again tomorrow or upgrade your plan.',
    );
  }
};
