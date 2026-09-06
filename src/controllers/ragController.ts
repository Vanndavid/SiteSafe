// src/controllers/ragController.ts
import { Request, Response } from 'express';
import { getRequestUserId } from '../utils/authUtils';
import { parsePositiveInt } from '../utils/numberUtils';
import { askDocuments } from '../services/ragAnswerService';
import { DEFAULT_TOP_K, type RetrievalMode } from '../services/retrievalService';

const MAX_QUESTION_LENGTH = 500;
const MAX_TOP_K = 20;

const parseMode = (value: unknown): RetrievalMode | undefined => {
  if (value === 'vector' || value === 'keyword' || value === 'hybrid') {
    return value;
  }
  return undefined;
};

// POST /api/ask
export const askQuestion = async (req: Request, res: Response) => {
  const rawQuestion = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

  if (!rawQuestion) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (rawQuestion.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Question must be ${MAX_QUESTION_LENGTH} characters or fewer` });
  }

  try {
    const userId = getRequestUserId(req);
    const projectId = parsePositiveInt(req.body?.projectId, 0) || undefined;
    const topK = Math.min(parsePositiveInt(req.body?.topK, DEFAULT_TOP_K), MAX_TOP_K);
    const mode = parseMode(req.body?.mode);

    const result = await askDocuments(rawQuestion, {
      userId,
      ...(projectId == null ? {} : { projectId }),
      topK,
      ...(mode == null ? {} : { mode }),
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to answer question:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
};
