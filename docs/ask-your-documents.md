# Ask your documents

Retrieval-augmented question answering over the compliance documents already in
SiteSafe. Ask a question in plain language, get an answer drawn only from your
own documents, with a citation back to the source document and page.

`POST /api/ask` — requires auth.

```json
{ "question": "When does Jordan Mercer's white card expire?", "projectId": 3 }
```

```json
{
  "question": "When does Jordan Mercer's white card expire?",
  "answer": "Jordan Mercer's white card expires on 2027-03-14.",
  "answered": true,
  "citations": [
    {
      "documentId": "…",
      "documentName": "White Card - J Mercer.pdf",
      "pageNumber": 1,
      "chunkId": "…"
    }
  ],
  "retrieval": { "mode": "hybrid", "chunkIds": ["…"] }
}
```

## The pipeline

| Stage | Where | What happens |
| --- | --- | --- |
| Extract | `services/geminiService.ts`, `lambdaWorker/index.js` | Vision pass returns the structured fields **and** a verbatim per-page transcription in `extractedData.pages`. |
| Chunk | `utils/chunker.ts` | ~500-token windows with ~50-token overlap. Chunks never span a page boundary. |
| Embed | `services/embeddingService.ts` | `gemini-embedding-001`, truncated to 768 dimensions and renormalised. |
| Store | `DocumentChunk` table | Vector in a pgvector column, keyword index in a generated `tsvector`. |
| Retrieve | `services/retrievalService.ts` | Vector + keyword search, merged with Reciprocal Rank Fusion, filtered by user. |
| Generate | `services/ragAnswerService.ts` | Gemini answers from the top 5 chunks, must cite, must decline when unsupported. |

### One prerequisite that did not exist before

Extraction previously stored only a one-paragraph **summary** (`extractedData.content`)
and no page numbers. There was no document text to chunk — chunking a summary
would have produced exactly one chunk per document and made retrieval
meaningless. The extraction prompt now also returns a verbatim per-page
transcription, which is what everything downstream reads.

Documents processed before this change have no page text. They will be reported
as skipped by the reindex script and need re-uploading to get a fresh extraction
pass:

```bash
npm run rag:reindex
```

### Access control

Every retrieval path filters by `userId` **inside the SQL**, not after it:

```sql
WHERE c."userId" = $1 AND c."projectId" = $2
```

Filtering a top-k list in application code is the common shortcut and it is
wrong twice over. It silently shrinks the result set whenever another tenant's
chunks outrank yours, and it means the database has already returned data the
caller was never allowed to see. `DocumentChunk` denormalises `userId` and
`projectId` from `Document` so the filter can sit inside the same indexed query.

The eval asserts this rather than assuming it: a second tenant is seeded holding
a byte-identical copy of one document, so it ranks equally well on every query
that matches the original. If the filter were missing, it would surface.

## Running the evaluation

Requires Postgres with pgvector, and a valid `GEMINI_API_KEY`.

### Getting a pgvector Postgres

The compose files use `pgvector/pgvector:pg16`, so `docker compose up -d postgres`
is the intended route.

If Docker is not usable, WSL works and does not need a compiler or admin rights:

```bash
wsl -d Ubuntu -e sudo apt-get install -y postgresql-16 postgresql-16-pgvector
```

Then set the cluster's `port = 5433` in `/etc/postgresql/16/main/postgresql.conf`
(5432 is usually taken by a Windows PostgreSQL service), set
`listen_addresses = '*'`, add `host all all 0.0.0.0/0 scram-sha-256` to
`pg_hba.conf`, restart with `sudo pg_ctlcluster 16 main restart`, and point
`DATABASE_URL` at `postgresql://postgres:postgres@localhost:5433/aicompliance`.
WSL2 forwards the port to Windows automatically.

### Running it

```bash
npx prisma migrate deploy
npm run eval
```

```bash
npm run eval -- --modes hybrid --no-seed
```

```bash
npm run eval -- --skip-answers
```

Results are written to `eval/results.json`. Chunking can also be analysed with
no database and no API key at all:

```bash
npx ts-node --project tsconfig.scripts.json eval/analyze-chunks.ts
```

## What the eval measures, and why it is two numbers

**Retrieval accuracy** — how often the chunk that actually contains the answer
appears in the top 5.

**Answer accuracy** — how often the final answer is right.

These are reported separately and never blended, because they fail for different
reasons and have different fixes. An answer can be wrong because retrieval never
surfaced the right passage — that is an indexing problem. Or the model can be
handed exactly the right passage and still get it wrong — that is a prompting
problem. A single combined score cannot tell you which, so it cannot tell you
what to work on next. The runner reports the two cross-terms directly:

- `generation failures (had gold, still wrong)` — retrieval did its job, the model did not.
- `answered right without the gold chunk` — got lucky, or the fact appears in more than one place.

### The question set

32 questions in `eval/dataset.ts`: **25 answerable**, **7 unanswerable**.

The unanswerable ones are the half most demos skip, and they are the reason the
metric means anything. Without them, a system that confidently answered
everything would score identically to one that knew its limits. They are chosen
to be tempting rather than absurd — asking for the excess on the workers
compensation policy when a *different* policy in the corpus does carry an
excess, or asking a question answerable from general knowledge but not from
these documents.

Gold labels are `(document, page)` pairs rather than chunk ids, because chunk
boundaries move whenever the chunker is tuned, and a label that must be rewritten
after every change is a label that will not stay accurate.

### The corpus

`eval/corpus/` holds 31 documents: 8 gold documents the questions are answered
from, plus 23 near-duplicate distractors.

The distractors are not padding. With only the gold documents seeded, the entire
index is 10 chunks and a top-5 retrieval returns half of everything — a random
retriever would score about 50% and no measurement would mean anything. With
distractors the random baseline drops to roughly 15%. They are deliberately the
*same kinds* of document — more white cards, more licences, more certificates of
currency, for different people — because that is what a real compliance corpus
looks like and it is the case that actually breaks naive retrieval: thirty
workers holding the same card type, same field labels, different dates.

The fixtures stand in for real documents because `uploads/` in this repo is
fifteen copies of the same 19KB PDF. Swapping in real extracted documents means
replacing `eval/corpus/` and the gold references in `eval/dataset.ts`.

## The improvement: hybrid search

The baseline is vector-only retrieval. The improvement is adding keyword search
alongside it and merging the two rankings with Reciprocal Rank Fusion.

RRF reads only each chunk's *rank* within a list, never its raw score. That
matters because cosine similarity (bounded 0–1) and Postgres `ts_rank_cd`
(unbounded, corpus-dependent) are not on comparable scales — any weighted sum of
the two would need retuning for every corpus.

Run `npm run eval` to produce the before/after; the runner prints the delta and
names which questions each mode fixed or broke.

The questions hybrid search is expected to fix are the exact-identifier ones —
`BLU-PL-889231`, `WC-4471-2290`. Embeddings are poor at alphanumeric identifiers
because the token sequence carries almost no semantic signal, while a keyword
index matches them exactly. The document name is weighted `A` in the tsvector
and the body `B`, so a question naming the document type ranks its chunks first.

## Findings

**Chunking barely fires on this document type.** Measured across the corpus:
chunks run 82–159 tokens, median 108, averaging 1.1 chunks per document. A
500-token target is sized for prose; compliance certificates are short, dense,
and mostly label/value pairs. In practice each *page* becomes one chunk, so the
retrieval unit here is the page, not a sub-page window. The overlap logic is
effectively dead code on single-page certificates. It earns its place on the
multi-page documents — the two-page liability certificate and the crane SWMS —
where the interesting clauses live on page 2, and on any longer document (a
policy wording, a full SWMS) that lands in a real corpus.

**Expiry dates do not get orphaned — on this corpus.** All 6 expiry-style dates
sit in a chunk that also names the holder or insured entity, because the
certificates are short enough that the whole page stays together. This would
stop being true the moment a document is long enough to split between the header
block and the dates table, which is the realistic failure for a multi-page
policy schedule. Two things guard against it: chunks never span a page boundary,
so a retrieved chunk always has one unambiguous page to cite, and the document
name is denormalised onto every chunk and indexed at weight `A`, so the document
type survives even when the chunk body omits it.

**Scanned documents are meaningfully worse, and they break the keyword half
specifically.** The scanned fixture contains 5 tokens with pipe-for-`l`
substitutions and 4 number-like tokens with letter `O` for zero — the expiry
date reads `2O27-O1-14`. Exact keyword matching on the licence number and the
date cannot fire at all. Only the vector half can recover those, and it recovers
them approximately. This is the case where hybrid search helps least, which is
worth knowing before promising it as a general fix: hybrid lifts exact-identifier
retrieval on clean text and does nothing for identifiers OCR has mangled. The
real fix is upstream, at extraction.

**Cost.** Per document, indexing is a one-off: ~155 tokens embedded across ~1.1
chunks, plus the vision extraction pass over the file. Per question: one query
embedding (~14 tokens), one generation call (~855 input tokens for 5 chunks plus
the prompt, ~60 output), and two indexed Postgres queries.

At 1,000 documents that is roughly 1,250 chunks and ~155k tokens embedded once,
about 3.7 MB of raw vector data. **Query cost is flat in corpus size** — top-k is
fixed and both indexes are sublinear in row count, so a question over 1,000
documents costs the same as a question over 10. What grows is HNSW index memory
and the recall/build tuning, not the per-query bill. Multiply the token counts by
current Gemini rates for dollar figures.

## Deliberately not built

No reranking, no agent loop, no chat history. One improvement, measured.

## Operational notes

- **Postgres must have pgvector.** The compose files now use
  `pgvector/pgvector:pg16`. On managed Postgres, `vector` must be on the
  extension allow-list before `prisma migrate deploy` runs.
- **Indexing failures do not fail the upload.** `POST /api/internal/documents/:id/processing-result`
  indexes after it saves, and logs rather than throwing if embedding fails —
  throwing would make SQS redeliver and re-run the vision call that was already
  paid for. The document is left unindexed and `npm run rag:reindex` picks it up.
- **Answers without a resolvable citation are downgraded** to "not found in your
  documents". An uncited answer is indistinguishable from a guess, and a
  citation index the model invented does not resolve to a retrieved chunk.
