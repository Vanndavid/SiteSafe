// src/services/retrievalService.ts
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { embedQuery, toVectorLiteral } from './embeddingService';
import { reciprocalRankFusion } from '../utils/rankFusion';

export const DEFAULT_TOP_K = 5;

// Each ranker is given more room than the final cut so fusion has something to
// disagree about; a chunk ranked 8th by vectors and 2nd by keywords should be
// able to surface, which it cannot if both lists are truncated at 5 first.
const CANDIDATE_MULTIPLIER = 4;

export type RetrievedChunk = {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  /** Cosine similarity in 0..1. Only set when the vector ranker returned it. */
  similarity?: number;
  /** Postgres ts_rank_cd. Only set when the keyword ranker returned it. */
  keywordRank?: number;
};

export type RetrievalMode = 'vector' | 'keyword' | 'hybrid';

export type RetrievalOptions = {
  userId: string;
  projectId?: number;
  topK?: number;
  mode?: RetrievalMode;
};

export type RetrievalResult = {
  mode: RetrievalMode;
  chunks: RetrievedChunk[];
};

type ChunkRow = {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  score: number;
};

/**
 * Every retrieval path goes through this predicate.
 *
 * Access control is applied inside the SQL, not after it. Filtering a top-k list
 * in application code would silently shrink the result set whenever another
 * tenant's chunks scored well, and the user would see fewer results without
 * anything reporting why.
 */
const accessFilter = (userId: string, projectId?: number) =>
  projectId == null
    ? Prisma.sql`c."userId" = ${userId}`
    : Prisma.sql`c."userId" = ${userId} AND c."projectId" = ${projectId}`;

const vectorSearch = async (
  queryEmbedding: number[],
  limit: number,
  userId: string,
  projectId?: number,
): Promise<ChunkRow[]> => {
  const literal = toVectorLiteral(queryEmbedding);

  // `<=>` is cosine distance, so similarity is 1 - distance. Ordering by the
  // operator directly is what lets the HNSW index serve the query.
  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."id",
      c."documentId",
      c."documentName",
      c."chunkIndex",
      c."pageNumber",
      c."content",
      1 - (c."embedding" <=> ${literal}::vector) AS "score"
    FROM "DocumentChunk" c
    WHERE ${accessFilter(userId, projectId)}
      AND c."embedding" IS NOT NULL
    ORDER BY c."embedding" <=> ${literal}::vector
    LIMIT ${limit}
  `;
};

const keywordSearch = async (
  question: string,
  limit: number,
  userId: string,
  projectId?: number,
): Promise<ChunkRow[]> => {
  // websearch_to_tsquery tolerates raw user input - quotes, OR, bare
  // punctuation - where plainto_tsquery would throw on some of it.
  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."id",
      c."documentId",
      c."documentName",
      c."chunkIndex",
      c."pageNumber",
      c."content",
      ts_rank_cd(c."searchVector", websearch_to_tsquery('english', ${question})) AS "score"
    FROM "DocumentChunk" c
    WHERE ${accessFilter(userId, projectId)}
      AND c."searchVector" @@ websearch_to_tsquery('english', ${question})
    ORDER BY "score" DESC
    LIMIT ${limit}
  `;
};

const toRetrieved = (row: ChunkRow, scoreKey: 'similarity' | 'keywordRank'): RetrievedChunk => ({
  id: row.id,
  documentId: row.documentId,
  documentName: row.documentName,
  chunkIndex: row.chunkIndex,
  pageNumber: row.pageNumber,
  content: row.content,
  [scoreKey]: Number(row.score),
});

/**
 * Retrieve the top-k chunks for a question.
 *
 * `mode` exists so the evaluation harness can measure the vector-only baseline
 * and the hybrid variant against the identical question set and access filter.
 */
export const retrieveChunks = async (
  question: string,
  options: RetrievalOptions,
): Promise<RetrievalResult> => {
  const { userId, projectId } = options;
  const topK = options.topK ?? DEFAULT_TOP_K;
  const mode = options.mode ?? 'hybrid';
  const candidateLimit = topK * CANDIDATE_MULTIPLIER;

  if (mode === 'keyword') {
    const rows = await keywordSearch(question, topK, userId, projectId);
    return { mode, chunks: rows.map(row => toRetrieved(row, 'keywordRank')) };
  }

  if (mode === 'vector') {
    const embedding = await embedQuery(question);
    const rows = await vectorSearch(embedding, topK, userId, projectId);
    return { mode, chunks: rows.map(row => toRetrieved(row, 'similarity')) };
  }

  const embedding = await embedQuery(question);
  const [vectorRows, keywordRows] = await Promise.all([
    vectorSearch(embedding, candidateLimit, userId, projectId),
    keywordSearch(question, candidateLimit, userId, projectId),
  ]);

  const fused = reciprocalRankFusion({
    vector: vectorRows.map(row => toRetrieved(row, 'similarity')),
    keyword: keywordRows.map(row => toRetrieved(row, 'keywordRank')),
  });

  // Carry both scores onto the merged row so a caller can see which ranker
  // found it; fusion keeps only the first object it saw for a given id.
  const keywordById = new Map(keywordRows.map(row => [row.id, Number(row.score)]));
  const vectorById = new Map(vectorRows.map(row => [row.id, Number(row.score)]));

  const chunks = fused.slice(0, topK).map(({ item }) => {
    const similarity = vectorById.get(item.id);
    const keywordRank = keywordById.get(item.id);
    return {
      ...item,
      ...(similarity == null ? {} : { similarity }),
      ...(keywordRank == null ? {} : { keywordRank }),
    };
  });

  return { mode, chunks };
};
