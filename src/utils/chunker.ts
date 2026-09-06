// src/utils/chunker.ts
// Pure text-chunking helpers. No I/O so the eval and unit tests can exercise
// chunking without a database or an API key.

export type DocumentPage = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
};

export type ChunkOptions = {
  targetTokens?: number;
  overlapTokens?: number;
};

const DEFAULT_TARGET_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

// Gemini does not expose a local tokenizer, so we approximate. Across English
// prose and the semi-structured text on compliance certificates, ~4 characters
// per token tracks the real count closely enough to size chunks consistently.
const CHARS_PER_TOKEN = 4;

export const estimateTokens = (text: string) =>
  Math.max(1, Math.ceil(text.trim().length / CHARS_PER_TOKEN));

// Split on sentence terminators AND newlines. Certificates are mostly short
// labelled lines ("Expiry Date: 2027-03-14") rather than sentences, so treating
// each line as a splittable unit keeps related label/value pairs intact.
export const splitIntoSegments = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

// Walk backwards through the segments just emitted and keep the trailing ones
// that fit inside the overlap budget, so the next chunk restates that context.
const buildOverlap = (segments: string[], overlapTokens: number): string[] => {
  if (overlapTokens <= 0) {
    return [];
  }

  const overlap: string[] = [];
  let budget = overlapTokens;

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]!;
    const cost = estimateTokens(segment);

    if (cost > budget) {
      break;
    }

    overlap.unshift(segment);
    budget -= cost;
  }

  return overlap;
};

/**
 * Chunk a document into overlapping windows of roughly `targetTokens`.
 *
 * Chunks never span a page boundary. That costs a little packing efficiency on
 * short pages, but it means every chunk has exactly one unambiguous page number
 * to cite, which is what the answer step needs.
 */
export const chunkDocument = (
  pages: DocumentPage[],
  options: ChunkOptions = {},
): TextChunk[] => {
  const targetTokens = options.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  const emit = (pageNumber: number, segments: string[]) => {
    const content = segments.join(' ').trim();
    if (!content) {
      return;
    }

    chunks.push({
      chunkIndex,
      pageNumber,
      content,
      tokenCount: estimateTokens(content),
    });
    chunkIndex += 1;
  };

  for (const page of pages) {
    const segments = splitIntoSegments(page.text || '');
    if (segments.length === 0) {
      continue;
    }

    let current: string[] = [];
    let currentTokens = 0;

    for (const segment of segments) {
      const cost = estimateTokens(segment);

      // A single segment longer than the target becomes its own chunk rather
      // than being cut mid-line, which would strand a value from its label.
      if (cost >= targetTokens) {
        if (current.length > 0) {
          emit(page.pageNumber, current);
        }
        emit(page.pageNumber, [segment]);
        current = [];
        currentTokens = 0;
        continue;
      }

      if (currentTokens + cost > targetTokens && current.length > 0) {
        emit(page.pageNumber, current);
        current = buildOverlap(current, overlapTokens);
        currentTokens = current.reduce((sum, part) => sum + estimateTokens(part), 0);
      }

      current.push(segment);
      currentTokens += cost;
    }

    if (current.length > 0) {
      emit(page.pageNumber, current);
    }
  }

  return chunks;
};
