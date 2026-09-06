// scripts/ragDoctor.ts
//
// Diagnoses why "Ask your documents" returns nothing, by walking the chain a
// question depends on and reporting the first link that is broken:
//
//   database reachable -> pgvector installed -> DocumentChunk table exists
//   -> documents processed -> page text captured -> chunks written
//   -> embeddings populated -> chunks owned by the asking user
//
//   npm run rag:doctor
//   npm run rag:doctor -- --user <userId>
//
// Reads DATABASE_URL, so point it at whichever environment you are checking.

import 'dotenv/config';
import prisma from '../src/config/prisma';
import { getStoredPages } from '../src/services/ragIngestService';

const pass = (msg: string, detail = '') => console.log(`  PASS  ${msg}${detail ? ` — ${detail}` : ''}`);
const fail = (msg: string, detail = '') => console.log(`  FAIL  ${msg}${detail ? ` — ${detail}` : ''}`);
const warn = (msg: string, detail = '') => console.log(`  WARN  ${msg}${detail ? ` — ${detail}` : ''}`);

const main = async () => {
  const userArg = process.argv.indexOf('--user');
  const userId = userArg >= 0 ? process.argv[userArg + 1] : undefined;

  const url = new URL(process.env.DATABASE_URL || '');
  console.log('\nDATABASE');
  console.log(`  target: ${url.hostname}:${url.port}${url.pathname} as ${url.username}`);

  const problems: string[] = [];

  // --- 1. connection -----------------------------------------------------
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    pass('connected');
  } catch (error) {
    fail('cannot connect', (error as Error).message.split('\n')[0]);
    console.log('\nNothing else can be checked until the connection works.\n');
    return;
  }

  // --- 2. pgvector -------------------------------------------------------
  console.log('\nEXTENSION');
  const ext = await prisma.$queryRawUnsafe<{ installed: string | null }[]>(
    `SELECT installed_version AS installed FROM pg_available_extensions WHERE name = 'vector'`,
  );
  if (ext.length === 0) {
    fail('pgvector is not available on this server');
    problems.push('This PostgreSQL build does not ship pgvector. Use the pgvector/pgvector image, or install postgresql-<ver>-pgvector.');
  } else if (!ext[0]!.installed) {
    fail('pgvector available but not installed in this database');
    problems.push('Run `npx prisma migrate deploy` against this database to create the extension.');
  } else {
    pass('pgvector installed', `v${ext[0]!.installed}`);
  }

  // --- 3. schema ---------------------------------------------------------
  console.log('\nSCHEMA');
  const table = await prisma.$queryRawUnsafe<{ h: boolean }[]>(
    `SELECT to_regclass('public."DocumentChunk"') IS NOT NULL AS h`,
  );
  if (!table[0]!.h) {
    fail('DocumentChunk table missing');
    problems.push('Migrations have not been applied here. Run `npx prisma migrate deploy`.');
    console.log('\n' + problems.map(p => '  * ' + p).join('\n') + '\n');
    return;
  }
  pass('DocumentChunk table exists');

  const indexes = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
    `SELECT indexdef FROM pg_indexes WHERE tablename = 'DocumentChunk'`,
  );
  const hasHnsw = indexes.some(i => /hnsw/i.test(i.indexdef));
  const hasGin = indexes.some(i => /gin/i.test(i.indexdef));
  hasHnsw ? pass('HNSW vector index present') : warn('HNSW vector index missing (searches still work, just slower)');
  hasGin ? pass('GIN keyword index present') : warn('GIN keyword index missing');

  // --- 4. documents ------------------------------------------------------
  console.log('\nDOCUMENTS');
  const byStatus = await prisma.document.groupBy({
    by: ['status'],
    _count: { _all: true },
    ...(userId ? { where: { userId } } : {}),
  });
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);

  if (total === 0) {
    fail('no documents in this database' + (userId ? ` for user ${userId}` : ''));
    problems.push('Nothing has been uploaded here. Check you are pointing at the environment where you actually uploaded.');
    console.log('\n' + problems.map(p => '  * ' + p).join('\n') + '\n');
    return;
  }

  pass(`${total} document(s)`, byStatus.map(r => `${r.status}=${r._count._all}`).join(', '));

  // --- 5. page text ------------------------------------------------------
  // This is the usual culprit: extraction only started storing verbatim page
  // text when the ask feature landed, so anything older has nothing to chunk.
  console.log('\nPAGE TEXT (what chunking reads)');
  const processed = await prisma.document.findMany({
    where: { status: 'processed', ...(userId ? { userId } : {}) },
    select: { id: true, originalName: true, extractedData: true },
  });

  const withPages = processed.filter(d => getStoredPages(d.extractedData).length > 0);
  const withoutPages = processed.filter(d => getStoredPages(d.extractedData).length === 0);

  if (withPages.length > 0) pass(`${withPages.length} processed document(s) have page text`);
  if (withoutPages.length > 0) {
    fail(`${withoutPages.length} processed document(s) have NO page text`);
    withoutPages.slice(0, 5).forEach(d => console.log(`          - ${d.originalName}`));
    if (withoutPages.length > 5) console.log(`          ... and ${withoutPages.length - 5} more`);
    problems.push('These were extracted before page text was captured. Re-upload them; `rag:reindex` cannot help, it needs a fresh extraction pass.');
  }

  // --- 6. chunks ---------------------------------------------------------
  console.log('\nCHUNKS');
  const chunkTotal = await prisma.documentChunk.count({
    where: userId ? { userId } : {},
  });
  if (chunkTotal === 0) {
    fail('no chunks stored — this is why questions return nothing');
  } else {
    pass(`${chunkTotal} chunk(s) stored`);
  }

  const missingEmbedding = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*)::int AS c FROM "DocumentChunk" WHERE "embedding" IS NULL`,
  );
  if ((missingEmbedding[0]?.c ?? 0) > 0) {
    fail(`${missingEmbedding[0]!.c} chunk(s) have no embedding`, 'vector search will skip these');
    problems.push('Re-run `npm run rag:reindex -- --all` with a working GEMINI_API_KEY.');
  } else if (chunkTotal > 0) {
    pass('every chunk has an embedding');
  }

  // Documents that should have chunks but do not.
  const indexable = withPages.map(d => d.id);
  if (indexable.length > 0) {
    const chunked = await prisma.documentChunk.groupBy({
      by: ['documentId'],
      where: { documentId: { in: indexable } },
    });
    const chunkedIds = new Set(chunked.map(c => c.documentId));
    const unindexed = withPages.filter(d => !chunkedIds.has(d.id));
    if (unindexed.length > 0) {
      fail(`${unindexed.length} document(s) have page text but no chunks`);
      unindexed.slice(0, 5).forEach(d => console.log(`          - ${d.originalName}`));
      problems.push('Run `npm run rag:reindex` — these can be indexed without re-extraction.');
    } else {
      pass('every document with page text has chunks');
    }
  }

  // --- 7. ownership ------------------------------------------------------
  // Retrieval filters on userId, so chunks owned by a different user are
  // invisible no matter how well they match.
  if (chunkTotal > 0) {
    console.log('\nOWNERSHIP (retrieval filters on this)');
    const owners = await prisma.documentChunk.groupBy({
      by: ['userId'],
      _count: { _all: true },
    });
    owners.forEach(o => console.log(`        ${o.userId}  ${o._count._all} chunk(s)`));
    if (userId && !owners.some(o => o.userId === userId)) {
      fail(`user ${userId} owns no chunks`, 'their questions will always return nothing');
    }
  }

  console.log('\n' + '='.repeat(70));
  if (problems.length === 0) {
    console.log('No problems found. If questions still return nothing, check that');
    console.log('GEMINI_API_KEY is valid — the query embedding needs it.');
  } else {
    console.log('WHAT TO DO:');
    problems.forEach(p => console.log('  * ' + p));
  }
  console.log('');
};

main()
  .then(() => prisma.$disconnect())
  .catch(async error => {
    console.error('Doctor failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
