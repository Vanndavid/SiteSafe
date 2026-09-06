// src/services/ragIngestService.ts
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { chunkDocument, type DocumentPage } from '../utils/chunker';
import { embedTexts, toVectorLiteral } from './embeddingService';

export type IngestResult = {
  documentId: string;
  chunksCreated: number;
  pagesIndexed: number;
};

/**
 * Chunk, embed, and store one document's text.
 *
 * Re-ingesting a document replaces its chunks wholesale rather than trying to
 * diff them, so a re-run after a chunking change cannot leave stale rows behind.
 */
export const ingestDocumentChunks = async (
  documentId: string,
  pages: DocumentPage[],
): Promise<IngestResult> => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, userId: true, projectId: true, originalName: true },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const chunks = chunkDocument(pages);

  // Delete outside the transaction guard below only if there is nothing to
  // insert; otherwise both happen together.
  if (chunks.length === 0) {
    await prisma.documentChunk.deleteMany({ where: { documentId } });
    return { documentId, chunksCreated: 0, pagesIndexed: 0 };
  }

  const embeddings = await embedTexts(
    chunks.map(chunk => chunk.content),
    'RETRIEVAL_DOCUMENT',
  );

  // Prisma cannot write an Unsupported() column through createMany, so the rows
  // go in as raw SQL with the vector literal cast on the way in.
  await prisma.$transaction(async tx => {
    await tx.documentChunk.deleteMany({ where: { documentId } });

    for (const [index, chunk] of chunks.entries()) {
      const embedding = embeddings[index];
      if (!embedding) {
        throw new Error(`Missing embedding for chunk ${index} of ${documentId}`);
      }

      await tx.$executeRaw`
        INSERT INTO "DocumentChunk" (
          "id", "documentId", "userId", "projectId", "chunkIndex",
          "pageNumber", "content", "documentName", "tokenCount", "embedding"
        ) VALUES (
          gen_random_uuid()::text,
          ${document.id},
          ${document.userId},
          ${document.projectId},
          ${chunk.chunkIndex},
          ${chunk.pageNumber},
          ${chunk.content},
          ${document.originalName},
          ${chunk.tokenCount},
          ${toVectorLiteral(embedding)}::vector
        )
      `;
    }
  });

  return {
    documentId,
    chunksCreated: chunks.length,
    pagesIndexed: new Set(chunks.map(chunk => chunk.pageNumber)).size,
  };
};

/**
 * Read back the page text captured at extraction time.
 *
 * Extraction stores `pages` on Document.extractedData so a chunking change can
 * be re-run over the corpus without paying for a second vision pass.
 */
export const getStoredPages = (extractedData: Prisma.JsonValue | null): DocumentPage[] => {
  if (!extractedData || typeof extractedData !== 'object' || Array.isArray(extractedData)) {
    return [];
  }

  const pages = (extractedData as Record<string, unknown>).pages;
  if (!Array.isArray(pages)) {
    return [];
  }

  return pages
    .map((page, index) => {
      if (!page || typeof page !== 'object') {
        return null;
      }
      const record = page as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text : '';
      if (!text.trim()) {
        return null;
      }
      const pageNumber = typeof record.page === 'number' ? record.page : index + 1;
      return { pageNumber, text };
    })
    .filter((page): page is DocumentPage => page !== null);
};

export const reindexDocument = async (documentId: string): Promise<IngestResult> => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { extractedData: true },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  return ingestDocumentChunks(documentId, getStoredPages(document.extractedData));
};
