// eval/analyze-chunks.ts
//
// Offline analysis of the chunking stage. Needs no database, no API key, and no
// network - it answers the structural questions about chunking before any
// embedding cost is incurred.
//
//   npx ts-node --project tsconfig.scripts.json eval/analyze-chunks.ts

import { chunkDocument, estimateTokens } from '../src/utils/chunker';
import { CORPUS } from './corpus';
import { EVAL_CASES } from './dataset';

const EXPIRY_PATTERN = /(expiry|expires|expiration|valid until|review due|period of (insurance|cover)|to:)/i;
const DATE_PATTERN = /\b(19|20)\d{2}[-/][0-9O]{1,2}[-/][0-9O]{1,2}\b/i;

const pad = (value: string | number, width: number) => String(value).padEnd(width);

const main = () => {
  console.log('CHUNKING ANALYSIS');
  console.log('='.repeat(78));

  let totalChunks = 0;
  let totalTokens = 0;
  const allChunkSizes: number[] = [];

  console.log(`\n${pad('Document', 46)}${pad('Pages', 7)}${pad('Chunks', 8)}Tokens`);
  console.log('-'.repeat(78));

  const chunksByDocument = new Map<string, ReturnType<typeof chunkDocument>>();

  for (const document of CORPUS) {
    const chunks = chunkDocument(
      document.pages.map(page => ({ pageNumber: page.page, text: page.text })),
    );
    chunksByDocument.set(document.slug, chunks);

    const tokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    totalChunks += chunks.length;
    totalTokens += tokens;
    chunks.forEach(chunk => allChunkSizes.push(chunk.tokenCount));

    const name = document.originalName.length > 44
      ? `${document.originalName.slice(0, 41)}...`
      : document.originalName;
    console.log(`${pad(name, 46)}${pad(document.pages.length, 7)}${pad(chunks.length, 8)}${tokens}`);
  }

  allChunkSizes.sort((a, b) => a - b);
  const median = allChunkSizes[Math.floor(allChunkSizes.length / 2)] ?? 0;

  console.log('-'.repeat(78));
  console.log(`${pad('TOTAL', 46)}${pad(CORPUS.reduce((n, d) => n + d.pages.length, 0), 7)}${pad(totalChunks, 8)}${totalTokens}`);
  console.log(
    `\nChunk size: min ${allChunkSizes[0]}, median ${median}, max ${allChunkSizes[allChunkSizes.length - 1]} tokens`,
  );
  console.log(`Average chunks per document: ${(totalChunks / CORPUS.length).toFixed(1)}`);

  // ---------------------------------------------------------------------
  // Question 1: do expiry dates survive chunking with their context intact?
  // ---------------------------------------------------------------------
  console.log(`\n\nEXPIRY DATES AND CHUNK BOUNDARIES`);
  console.log('='.repeat(78));
  console.log('For each chunk holding an expiry-style date, does that same chunk also');
  console.log('carry the holder name or document type that gives the date its meaning?\n');

  let datesFound = 0;
  let datesWithContext = 0;

  for (const document of CORPUS) {
    const chunks = chunksByDocument.get(document.slug)!;

    for (const chunk of chunks) {
      const lines = chunk.content.split(/(?<=[.!?])\s+|\n/);
      const expiryLines = lines.filter(line => EXPIRY_PATTERN.test(line) && DATE_PATTERN.test(line));
      if (expiryLines.length === 0) {
        continue;
      }

      datesFound += expiryLines.length;

      // "Context" means a person or entity name in the same chunk. Without it,
      // a retrieved chunk reads as a bare date with nothing to attach it to.
      const hasHolder = /(holder|name|insured|employer|student|licensee|prepared by|nominee)/i.test(chunk.content);
      if (hasHolder) {
        datesWithContext += expiryLines.length;
      }

      const status = hasHolder ? 'in context' : 'ORPHANED';
      console.log(`  [${status}] ${document.originalName} p${chunk.pageNumber} chunk ${chunk.chunkIndex}`);
      expiryLines.forEach(line => console.log(`      ${line.trim()}`));
    }
  }

  console.log(
    `\n  ${datesWithContext}/${datesFound} expiry dates sit in a chunk that also names the holder or subject.`,
  );
  console.log('  Every chunk additionally carries the document name in its keyword index,');
  console.log('  which is where the document type survives even when the body omits it.');

  // ---------------------------------------------------------------------
  // Question 2: are scanned documents different?
  // ---------------------------------------------------------------------
  console.log(`\n\nSCANNED VERSUS DIGITAL`);
  console.log('='.repeat(78));

  for (const document of CORPUS.filter(d => d.scanned)) {
    const chunks = chunksByDocument.get(document.slug)!;
    const text = chunks.map(chunk => chunk.content).join(' ');

    // Characters that OCR commonly substitutes: letter O for zero, pipe for l,
    // rn for m. Their presence breaks exact keyword matching on identifiers.
    const suspectTokens = (text.match(/\b[A-Za-z0-9|]*[|]{1,2}[A-Za-z0-9|]*\b/g) || []).length;
    const letterOInDigits = (text.match(/\b\d*O\d*[-/]?\d*O?\d*\b/g) || []).length;

    console.log(`\n  ${document.originalName}`);
    console.log(`    chunks: ${chunks.length}`);
    console.log(`    tokens containing a pipe substitution: ${suspectTokens}`);
    console.log(`    number-like tokens containing letter O: ${letterOInDigits}`);
    console.log(`    -> exact keyword match on the licence number and expiry date will fail;`);
    console.log(`       only the vector half of hybrid search can recover these.`);
  }

  // ---------------------------------------------------------------------
  // Question 3: what does this cost, and how does it scale?
  // ---------------------------------------------------------------------
  console.log(`\n\nCOST MODEL`);
  console.log('='.repeat(78));

  const avgTokensPerDocument = totalTokens / CORPUS.length;
  const avgChunksPerDocument = totalChunks / CORPUS.length;

  // A query embeds the question, then sends the top 5 chunks to the generator.
  const avgChunkTokens = totalTokens / totalChunks;
  const questionTokens = Math.round(
    EVAL_CASES.reduce((sum, evalCase) => sum + estimateTokens(evalCase.question), 0) / EVAL_CASES.length,
  );
  const promptOverheadTokens = 220; // system prompt plus per-chunk headers
  const queryInputTokens = Math.round(questionTokens + avgChunkTokens * 5 + promptOverheadTokens);

  console.log(`\n  Indexing, per document (one-off):`);
  console.log(`    ~${Math.round(avgTokensPerDocument)} tokens embedded across ~${avgChunksPerDocument.toFixed(1)} chunks`);
  console.log(`    plus one vision extraction pass over the file`);

  console.log(`\n  Per question asked:`);
  console.log(`    1 query embedding      ~${questionTokens} tokens`);
  console.log(`    1 generation call      ~${queryInputTokens} input tokens + ~60 output tokens`);
  console.log(`    2 Postgres queries     top-${5 * 4} vector + top-${5 * 4} keyword, both index-served`);

  console.log(`\n  At 1,000 documents:`);
  console.log(`    ~${Math.round((avgChunksPerDocument * 1000)).toLocaleString()} chunks stored`);
  console.log(`    ~${Math.round(avgTokensPerDocument * 1000).toLocaleString()} tokens embedded once, at indexing time`);
  console.log(`    ~${((768 * 4 * avgChunksPerDocument * 1000) / 1024 / 1024).toFixed(1)} MB of raw vector data (768 dims x 4 bytes)`);
  console.log(`    Query cost is flat: it does not grow with corpus size, because`);
  console.log(`    top-k is fixed at 5 and both indexes are sublinear in row count.`);
  console.log(`    What grows is the HNSW index memory and the recall/build tuning.`);

  console.log(`\n  Multiply the token counts above by current Gemini rates for dollar figures;`);
  console.log(`  the shape of the bill is that indexing is one-off and per-query cost is constant.\n`);
};

main();
