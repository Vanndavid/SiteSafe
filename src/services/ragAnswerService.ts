// src/services/ragAnswerService.ts
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { retrieveChunks, DEFAULT_TOP_K, type RetrievalMode, type RetrievedChunk } from './retrievalService';

dotenv.config();

const MODEL_ID = process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash';

export const NOT_FOUND_ANSWER = 'Not found in your documents.';

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    // The SDK falls back to GEMINI_API_KEY itself, so the key is only passed
    // when it is actually set - under exactOptionalPropertyTypes, handing it an
    // explicit undefined is a type error rather than a no-op.
    client = new GoogleGenAI(apiKey ? { apiKey } : {});
  }
  return client;
};

export type Citation = {
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
};

export type AnswerResult = {
  question: string;
  answer: string;
  answered: boolean;
  citations: Citation[];
  retrieval: {
    mode: RetrievalMode;
    chunkIds: string[];
  };
};

// Chunks are numbered in the prompt so the model can cite by index, which is a
// far smaller target to hit exactly than a UUID it would have to transcribe.
const buildContext = (chunks: RetrievedChunk[]) =>
  chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] Document: ${chunk.documentName} (page ${chunk.pageNumber})\n${chunk.content}`,
    )
    .join('\n\n---\n\n');

const SYSTEM_PROMPT = `You are a compliance assistant. Answer ONLY from the numbered document excerpts provided.

Rules:
1. Use only facts present in the excerpts. Never use outside knowledge, and never guess or infer a value that is not written there.
2. If the excerpts do not contain the answer, set "answer" to exactly "${NOT_FOUND_ANSWER}" and return an empty "sources" array. A wrong answer is far worse than admitting the documents do not cover it.
3. Every answer that is not the not-found response must cite the excerpt numbers it came from in "sources".
4. Keep the answer to one or two sentences. Quote dates, licence numbers, and names exactly as they appear.

Output ONLY raw JSON: { "answer": "string", "sources": [number] }`;

const parseModelJson = (text: string | undefined): { answer: string; sources: number[] } => {
  const cleaned = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!cleaned) {
    throw new Error('Empty response from AI');
  }

  const parsed = JSON.parse(cleaned) as { answer?: unknown; sources?: unknown };
  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
  if (!answer) {
    throw new Error('AI response missing an answer');
  }

  const sources = Array.isArray(parsed.sources)
    ? parsed.sources.filter((value): value is number => Number.isInteger(value))
    : [];

  return { answer, sources };
};

export type AskOptions = {
  userId: string;
  projectId?: number;
  topK?: number;
  mode?: RetrievalMode;
};

export const askDocuments = async (
  question: string,
  options: AskOptions,
): Promise<AnswerResult> => {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const retrieval = await retrieveChunks(question, {
    userId: options.userId,
    ...(options.projectId == null ? {} : { projectId: options.projectId }),
    topK,
    ...(options.mode == null ? {} : { mode: options.mode }),
  });

  const chunkIds = retrieval.chunks.map(chunk => chunk.id);

  // Nothing retrieved means nothing to ground an answer in. Short-circuiting
  // here also avoids paying for a generation call that can only decline.
  if (retrieval.chunks.length === 0) {
    return {
      question,
      answer: NOT_FOUND_ANSWER,
      answered: false,
      citations: [],
      retrieval: { mode: retrieval.mode, chunkIds },
    };
  }

  const response = await getClient().models.generateContent({
    model: MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `\n\nDocument excerpts:\n\n${buildContext(retrieval.chunks)}` },
          { text: `\n\nQuestion: ${question}` },
        ],
      },
    ],
    config: { responseMimeType: 'application/json', temperature: 0 },
  });

  const { answer, sources } = parseModelJson(response.text);
  const isNotFound = answer.toLowerCase().startsWith('not found in your documents');

  // Map the model's excerpt numbers back to real chunks, dropping any index it
  // invented. A citation that does not resolve to a retrieved chunk is not a
  // citation, and silently rendering it would defeat the point of asking for one.
  const citations: Citation[] = isNotFound
    ? []
    : sources
        .map(sourceNumber => retrieval.chunks[sourceNumber - 1])
        .filter((chunk): chunk is RetrievedChunk => chunk != null)
        .map(chunk => ({
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          pageNumber: chunk.pageNumber,
          chunkId: chunk.id,
        }));

  // An uncited answer is indistinguishable from a guess, so it is downgraded to
  // the not-found response rather than shown to the user as a finding.
  if (!isNotFound && citations.length === 0) {
    return {
      question,
      answer: NOT_FOUND_ANSWER,
      answered: false,
      citations: [],
      retrieval: { mode: retrieval.mode, chunkIds },
    };
  }

  return {
    question,
    answer: isNotFound ? NOT_FOUND_ANSWER : answer,
    answered: !isNotFound,
    citations,
    retrieval: { mode: retrieval.mode, chunkIds },
  };
};
