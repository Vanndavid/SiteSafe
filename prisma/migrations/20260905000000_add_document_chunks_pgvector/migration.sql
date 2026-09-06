-- Retrieval support for the "Ask your documents" feature.

-- pgvector ships with the pgvector/pgvector images; on managed Postgres it must
-- be on the allow-list before this runs.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- Keyword half of hybrid search. Generated (not trigger-maintained) so it can
-- never drift from the row it describes. The document name is weighted 'A' and
-- the body 'B', so a query naming the document type ranks its chunks higher.
ALTER TABLE "DocumentChunk"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("documentName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
) STORED;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key" ON "DocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "DocumentChunk_userId_idx" ON "DocumentChunk"("userId");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- GIN over the generated tsvector for the keyword ranker.
CREATE INDEX "DocumentChunk_searchVector_idx" ON "DocumentChunk" USING GIN ("searchVector");

-- HNSW over cosine distance for the vector ranker. Chosen over IVFFlat because
-- IVFFlat must be built against an already-populated table to pick useful
-- centroids, which a from-scratch deployment does not have.
CREATE INDEX "DocumentChunk_embedding_idx" ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
