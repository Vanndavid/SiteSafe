// scripts/reindexDocuments.ts
//
// Re-chunk and re-embed processed documents from the page text already stored
// on Document.extractedData. Used to backfill documents that were processed
// before retrieval existed, and to roll out a chunking change without paying
// for a second vision pass over the corpus.
//
//   npm run rag:reindex              # only documents with no chunks yet
//   npm run rag:reindex -- --all     # every processed document

import 'dotenv/config';
import prisma from '../src/config/prisma';
import { getStoredPages, ingestDocumentChunks } from '../src/services/ragIngestService';

const main = async () => {
  const reindexAll = process.argv.includes('--all');

  const documents = await prisma.document.findMany({
    where: {
      status: 'processed',
      ...(reindexAll ? {} : { chunks: { none: {} } }),
    },
    select: { id: true, originalName: true, extractedData: true },
  });

  console.log(`Found ${documents.length} document(s) to index.`);

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  for (const document of documents) {
    const pages = getStoredPages(document.extractedData);

    // Documents extracted before the prompt captured page text have nothing to
    // chunk. They need re-extraction, not re-indexing, so they are reported
    // rather than silently counted as done.
    if (pages.length === 0) {
      console.warn(`  skip  ${document.originalName} - no page text stored (re-upload to extract it)`);
      skipped += 1;
      continue;
    }

    try {
      const result = await ingestDocumentChunks(document.id, pages);
      console.log(`  ok    ${document.originalName} - ${result.chunksCreated} chunks across ${result.pagesIndexed} page(s)`);
      indexed += 1;
    } catch (error) {
      console.error(`  fail  ${document.originalName}:`, (error as Error).message);
      failed += 1;
    }
  }

  console.log(`\nIndexed ${indexed}, skipped ${skipped}, failed ${failed}.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
};

main()
  .then(() => prisma.$disconnect())
  .catch(async error => {
    console.error('Reindex failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
