// src/services/embeddingService.ts
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL_ID || 'gemini-embedding-001';

// gemini-embedding-001 emits 3072 dimensions by default and supports Matryoshka
// truncation. 768 keeps the pgvector rows a quarter of the size and stays well
// under the 2000-dimension ceiling for indexed columns, at a negligible
// retrieval-quality cost on a corpus this size.
export const EMBEDDING_DIMENSIONS = 768;

// The API rejects oversized batches; documents are chunked well below this so
// batching is only about round-trip count, not payload limits.
const MAX_BATCH_SIZE = 100;

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

// Truncated Matryoshka embeddings are no longer unit length, so cosine
// similarity needs them renormalised before they are stored or compared.
const normalize = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map(value => value / magnitude);
};

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

/**
 * Embed a batch of texts.
 *
 * `taskType` is not cosmetic: the model places questions and passages in
 * different regions unless it is told which is which, so indexing must use
 * RETRIEVAL_DOCUMENT and querying RETRIEVAL_QUERY for the two to line up.
 */
export const embedTexts = async (
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }

  const ai = getClient();
  const results: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);

    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      },
    });

    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: requested ${batch.length}, received ${embeddings.length}`,
      );
    }

    for (const embedding of embeddings) {
      const values = embedding.values;
      if (!values || values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Expected ${EMBEDDING_DIMENSIONS}-dimension embedding, received ${values?.length ?? 0}`,
        );
      }
      results.push(normalize(values));
    }
  }

  return results;
};

export const embedQuery = async (question: string): Promise<number[]> => {
  const [embedding] = await embedTexts([question], 'RETRIEVAL_QUERY');
  if (!embedding) {
    throw new Error('Failed to embed query');
  }
  return embedding;
};

// pgvector accepts its literal form as a bracketed, comma-separated string.
export const toVectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;
