// eval/run.ts
//
// Runs the evaluation set against a seeded corpus and reports retrieval
// accuracy and answer accuracy separately, for each retrieval mode.
//
//   npm run eval            # seed, then evaluate vector and hybrid
//   npm run eval -- --modes hybrid --no-seed
//   npm run eval -- --skip-answers        # retrieval only, no generation calls

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';
import { retrieveChunks, type RetrievalMode } from '../src/services/retrievalService';
import { askDocuments, NOT_FOUND_ANSWER } from '../src/services/ragAnswerService';
import { EVAL_CASES, type EvalCase } from './dataset';
import { seedEvalCorpus, EVAL_OWNER_ID, EVAL_INTRUDER_ID, type SeededCorpus } from './seed';
import { CORPUS } from './corpus';

const TOP_K = 5;

type CaseOutcome = {
  id: string;
  question: string;
  unanswerable: boolean;
  scanned: boolean;
  retrievalHit: boolean | null;
  retrievalRank: number | null;
  answerCorrect: boolean | null;
  answer: string;
  citedDocuments: string[];
  retrievedLabels: string[];
};

type ModeReport = {
  mode: RetrievalMode;
  outcomes: CaseOutcome[];
  retrieval: { hits: number; total: number; accuracy: number };
  answers: {
    correct: number;
    total: number;
    accuracy: number;
    answerableCorrect: number;
    answerableTotal: number;
    abstentionCorrect: number;
    abstentionTotal: number;
    /** Right answer produced despite retrieval missing the gold chunk. */
    correctWithoutGold: number;
    /** Gold chunk retrieved and the answer still wrong - a generation failure. */
    fumbledWithGold: number;
  };
};

// Compare on lowercase alphanumerics only, so "AUD 20,000,000" matches
// "$20,000,000" and "2027-03-14" matches "14 March 2027" is *not* claimed to
// match. Dates are required in the document's own format on purpose.
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '');

const containsAll = (answer: string, required: string[]) => {
  const haystack = normalize(answer);
  return required.every(fragment => haystack.includes(normalize(fragment)));
};

const isNotFound = (answer: string) => normalize(answer).startsWith(normalize(NOT_FOUND_ANSWER));

const scannedSlugs = new Set(CORPUS.filter(document => document.scanned).map(d => d.slug));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const modesArg = args.indexOf('--modes');
  const modes: RetrievalMode[] =
    modesArg >= 0 && args[modesArg + 1]
      ? (args[modesArg + 1]!.split(',') as RetrievalMode[])
      : ['vector', 'hybrid'];

  return {
    modes,
    seed: !args.includes('--no-seed'),
    skipAnswers: args.includes('--skip-answers'),
  };
};

/**
 * Did the top-k contain a chunk from the page that actually holds the answer?
 *
 * Gold is a (document, page) pair rather than a chunk id because chunk
 * boundaries move whenever the chunker changes, and a label that has to be
 * rewritten after every tuning pass is a label nobody will keep accurate.
 */
const scoreRetrieval = (evalCase: EvalCase, seeded: SeededCorpus, labels: string[]) => {
  if (!evalCase.gold) {
    return { hit: null, rank: null };
  }

  const goldDocumentId = seeded.documentIds.get(evalCase.gold.documentSlug);
  const goldLabel = `${goldDocumentId}#p${evalCase.gold.pageNumber}`;
  const index = labels.indexOf(goldLabel);

  return { hit: index >= 0, rank: index >= 0 ? index + 1 : null };
};

const runMode = async (
  mode: RetrievalMode,
  seeded: SeededCorpus,
  skipAnswers: boolean,
): Promise<ModeReport> => {
  const outcomes: CaseOutcome[] = [];

  for (const evalCase of EVAL_CASES) {
    const retrieval = await retrieveChunks(evalCase.question, {
      userId: seeded.ownerId,
      topK: TOP_K,
      mode,
    });

    const labels = retrieval.chunks.map(chunk => `${chunk.documentId}#p${chunk.pageNumber}`);
    const { hit, rank } = scoreRetrieval(evalCase, seeded, labels);

    let answer = '';
    let answerCorrect: boolean | null = null;
    let citedDocuments: string[] = [];

    if (!skipAnswers) {
      const result = await askDocuments(evalCase.question, {
        userId: seeded.ownerId,
        topK: TOP_K,
        mode,
      });
      answer = result.answer;
      citedDocuments = result.citations.map(citation => citation.documentName);

      answerCorrect = evalCase.unanswerable
        ? isNotFound(answer)
        : !isNotFound(answer) && containsAll(answer, evalCase.expectedAnswerContains);
    }

    outcomes.push({
      id: evalCase.id,
      question: evalCase.question,
      unanswerable: Boolean(evalCase.unanswerable),
      scanned: evalCase.gold ? scannedSlugs.has(evalCase.gold.documentSlug) : false,
      retrievalHit: hit,
      retrievalRank: rank,
      answerCorrect,
      answer,
      citedDocuments,
      retrievedLabels: labels,
    });
  }

  const graded = outcomes.filter(outcome => outcome.retrievalHit !== null);
  const hits = graded.filter(outcome => outcome.retrievalHit).length;

  const answered = outcomes.filter(outcome => outcome.answerCorrect !== null);
  const answerable = answered.filter(outcome => !outcome.unanswerable);
  const abstentions = answered.filter(outcome => outcome.unanswerable);

  return {
    mode,
    outcomes,
    retrieval: {
      hits,
      total: graded.length,
      accuracy: graded.length === 0 ? 0 : hits / graded.length,
    },
    answers: {
      correct: answered.filter(outcome => outcome.answerCorrect).length,
      total: answered.length,
      accuracy:
        answered.length === 0
          ? 0
          : answered.filter(outcome => outcome.answerCorrect).length / answered.length,
      answerableCorrect: answerable.filter(outcome => outcome.answerCorrect).length,
      answerableTotal: answerable.length,
      abstentionCorrect: abstentions.filter(outcome => outcome.answerCorrect).length,
      abstentionTotal: abstentions.length,
      correctWithoutGold: answerable.filter(o => o.answerCorrect && o.retrievalHit === false).length,
      fumbledWithGold: answerable.filter(o => !o.answerCorrect && o.retrievalHit === true).length,
    },
  };
};

/**
 * Confirm the access filter actually filters.
 *
 * The intruder holds an identical copy of a corpus document, so a query that
 * matches the owner's copy matches theirs equally well. If the filter were
 * missing, the intruder's chunks would rank just as highly.
 */
const runAccessControlCheck = async (seeded: SeededCorpus) => {
  const question = EVAL_CASES[0]!.question;

  const asOwner = await retrieveChunks(question, { userId: seeded.ownerId, topK: TOP_K });
  const asIntruder = await retrieveChunks(question, { userId: seeded.intruderId, topK: TOP_K });
  const asStranger = await retrieveChunks(question, { userId: 'nobody-owns-anything', topK: TOP_K });

  const ownerSawIntruder = asOwner.chunks.some(c => c.documentId === seeded.intruderDocumentId);
  const intruderSawOwner = asIntruder.chunks.some(c => c.documentId !== seeded.intruderDocumentId);

  // Project scoping: a Southbank-only query must not reach Northside documents.
  const scoped = await retrieveChunks('When does the white card expire?', {
    userId: seeded.ownerId,
    projectId: seeded.projectIds.southbank,
    topK: TOP_K,
  });
  const northsideIds = new Set(
    CORPUS.filter(d => d.project === 'northside').map(d => seeded.documentIds.get(d.slug)),
  );
  const scopeLeaked = scoped.chunks.some(chunk => northsideIds.has(chunk.documentId));

  return {
    ownerSawIntruder,
    intruderSawOwner,
    strangerGotNothing: asStranger.chunks.length === 0,
    scopeLeaked,
    passed: !ownerSawIntruder && !intruderSawOwner && asStranger.chunks.length === 0 && !scopeLeaked,
  };
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const printModeReport = (report: ModeReport, skipAnswers: boolean) => {
  console.log(`\n=== ${report.mode.toUpperCase()} ===`);
  console.log(
    `Retrieval accuracy (gold chunk in top ${TOP_K}): ` +
      `${percent(report.retrieval.accuracy)}  (${report.retrieval.hits}/${report.retrieval.total})`,
  );

  if (skipAnswers) {
    return;
  }

  const { answers } = report;
  console.log(
    `Answer accuracy:                              ` +
      `${percent(answers.accuracy)}  (${answers.correct}/${answers.total})`,
  );
  console.log(
    `  on answerable questions:                    ` +
      `${percent(answers.answerableCorrect / answers.answerableTotal)}  ` +
      `(${answers.answerableCorrect}/${answers.answerableTotal})`,
  );
  console.log(
    `  correctly declined (unanswerable):          ` +
      `${percent(answers.abstentionCorrect / answers.abstentionTotal)}  ` +
      `(${answers.abstentionCorrect}/${answers.abstentionTotal})`,
  );
  console.log(
    `  generation failures (had gold, still wrong): ${answers.fumbledWithGold}`,
  );
  console.log(
    `  answered right without the gold chunk:       ${answers.correctWithoutGold}`,
  );

  const failures = report.outcomes.filter(o => o.answerCorrect === false || o.retrievalHit === false);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const failure of failures) {
      const retrievalNote =
        failure.retrievalHit === false ? 'retrieval MISS' : `retrieval ok (rank ${failure.retrievalRank})`;
      const answerNote = failure.answerCorrect === false ? 'answer WRONG' : 'answer ok';
      console.log(`    ${failure.id}  ${retrievalNote}, ${answerNote}`);
      console.log(`         Q: ${failure.question}`);
      console.log(`         A: ${failure.answer.slice(0, 140)}`);
    }
  }
};

const printComparison = (reports: ModeReport[], skipAnswers: boolean) => {
  if (reports.length < 2) {
    return;
  }

  const baseline = reports[0]!;
  const improved = reports[reports.length - 1]!;

  console.log(`\n=== ${baseline.mode} -> ${improved.mode} ===`);
  console.log(
    `Retrieval accuracy: ${percent(baseline.retrieval.accuracy)} -> ${percent(improved.retrieval.accuracy)}` +
      `  (${improved.retrieval.hits - baseline.retrieval.hits >= 0 ? '+' : ''}` +
      `${improved.retrieval.hits - baseline.retrieval.hits} questions)`,
  );

  if (!skipAnswers) {
    console.log(
      `Answer accuracy:    ${percent(baseline.answers.accuracy)} -> ${percent(improved.answers.accuracy)}` +
        `  (${improved.answers.correct - baseline.answers.correct >= 0 ? '+' : ''}` +
        `${improved.answers.correct - baseline.answers.correct} questions)`,
    );
  }

  const fixed = improved.outcomes.filter(outcome => {
    const before = baseline.outcomes.find(o => o.id === outcome.id);
    return before?.retrievalHit === false && outcome.retrievalHit === true;
  });
  const broken = improved.outcomes.filter(outcome => {
    const before = baseline.outcomes.find(o => o.id === outcome.id);
    return before?.retrievalHit === true && outcome.retrievalHit === false;
  });

  if (fixed.length > 0) {
    console.log(`\nRetrieval fixed by ${improved.mode}:`);
    fixed.forEach(o => console.log(`  ${o.id}  ${o.question}`));
  }
  if (broken.length > 0) {
    console.log(`\nRetrieval broken by ${improved.mode}:`);
    broken.forEach(o => console.log(`  ${o.id}  ${o.question}`));
  }
};

const printScannedBreakdown = (report: ModeReport) => {
  const scanned = report.outcomes.filter(o => o.scanned && o.retrievalHit !== null);
  const digital = report.outcomes.filter(o => !o.scanned && o.retrievalHit !== null);
  if (scanned.length === 0) {
    return;
  }

  const rate = (items: CaseOutcome[]) =>
    items.length === 0 ? 'n/a' : percent(items.filter(o => o.retrievalHit).length / items.length);

  console.log(`\nScanned vs digital retrieval (${report.mode}):`);
  console.log(`  digital: ${rate(digital)} (${digital.length} questions)`);
  console.log(`  scanned: ${rate(scanned)} (${scanned.length} questions)`);
};

const main = async () => {
  const { modes, seed, skipAnswers } = parseArgs();

  let seeded: SeededCorpus;
  if (seed) {
    console.log('Seeding evaluation corpus...');
    seeded = await seedEvalCorpus();
  } else {
    seeded = await rebuildSeedHandles();
  }

  console.log('\nChecking access control...');
  const access = await runAccessControlCheck(seeded);
  console.log(`  owner saw other tenant's chunks:  ${access.ownerSawIntruder ? 'YES - LEAK' : 'no'}`);
  console.log(`  other tenant saw owner's chunks:  ${access.intruderSawOwner ? 'YES - LEAK' : 'no'}`);
  console.log(`  unknown user retrieved nothing:   ${access.strangerGotNothing ? 'yes' : 'NO - LEAK'}`);
  console.log(`  project scope held:               ${access.scopeLeaked ? 'NO - LEAK' : 'yes'}`);
  if (!access.passed) {
    console.error('\nACCESS CONTROL CHECK FAILED - retrieval is leaking across tenants.');
  }

  const reports: ModeReport[] = [];
  for (const mode of modes) {
    console.log(`\nRunning ${EVAL_CASES.length} questions in ${mode} mode...`);
    const report = await runMode(mode, seeded, skipAnswers);
    reports.push(report);
    printModeReport(report, skipAnswers);
    printScannedBreakdown(report);
  }

  printComparison(reports, skipAnswers);

  const outputPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        topK: TOP_K,
        questionCount: EVAL_CASES.length,
        accessControl: access,
        reports: reports.map(report => ({
          mode: report.mode,
          retrieval: report.retrieval,
          answers: report.answers,
          outcomes: report.outcomes,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${outputPath}`);

  if (!access.passed) {
    process.exitCode = 1;
  }
};

// Rebuild the id map for a --no-seed run without touching any rows.
const rebuildSeedHandles = async (): Promise<SeededCorpus> => {
  const documentIds = new Map<string, string>();
  for (const document of CORPUS) {
    documentIds.set(document.slug, `eval-doc-${document.slug}`);
  }

  const northside = await prisma.project.findFirst({
    where: { userId: EVAL_OWNER_ID, name: 'Northside Civil (eval)' },
  });
  const southbank = await prisma.project.findFirst({
    where: { userId: EVAL_OWNER_ID, name: 'Southbank Fitout (eval)' },
  });

  if (!northside || !southbank) {
    throw new Error('Eval corpus is not seeded. Run without --no-seed first.');
  }

  return {
    ownerId: EVAL_OWNER_ID,
    intruderId: EVAL_INTRUDER_ID,
    projectIds: { northside: northside.id, southbank: southbank.id },
    documentIds,
    intruderDocumentId: `eval-doc-${CORPUS[0]!.slug}-intruder`,
  };
};

main()
  .then(() => prisma.$disconnect())
  .catch(async error => {
    console.error('Evaluation failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
