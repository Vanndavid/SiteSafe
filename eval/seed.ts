// eval/seed.ts
//
// Loads the fixture corpus into Postgres and indexes it, so the eval runs
// against the same tables, the same access filter, and the same retrieval code
// the API uses. Idempotent: re-running replaces the seeded rows.

import 'dotenv/config';
import prisma from '../src/config/prisma';
import { ingestDocumentChunks } from '../src/services/ragIngestService';
import { CORPUS, type CorpusDocument } from './corpus';

// Fixed ids so the eval, the seeder, and any manual poking all agree on who
// owns what without a lookup step.
export const EVAL_OWNER_ID = 'eval-owner-0000-0000-0000-000000000001';
export const EVAL_INTRUDER_ID = 'eval-intruder-0000-0000-0000-00000002';

const EVAL_OWNER_EMAIL = 'eval-owner@sitesafe.local';
const EVAL_INTRUDER_EMAIL = 'eval-intruder@sitesafe.local';

// Not a credential: these accounts exist only inside a local eval database and
// no login path is exercised. Stored as an obvious placeholder so nobody
// mistakes it for a real hash.
const UNUSABLE_PASSWORD = 'x-eval-fixture-no-login';

export type SeededCorpus = {
  ownerId: string;
  intruderId: string;
  projectIds: Record<CorpusDocument['project'], number>;
  /** corpus slug -> seeded Document id */
  documentIds: Map<string, string>;
  /** Document id of the copy owned by the other tenant. */
  intruderDocumentId: string;
};

const upsertUser = async (id: string, email: string, name: string) => {
  await prisma.user.upsert({
    where: { id },
    update: { email, name },
    create: { id, email, name, password: UNUSABLE_PASSWORD },
  });
};

const resetProject = async (userId: string, name: string) => {
  // Projects use an autoincrement id, so they are matched by (owner, name)
  // rather than a fixed id. Deleting cascades to chunks via Document.
  const existing = await prisma.project.findFirst({ where: { userId, name } });

  if (existing) {
    await prisma.document.deleteMany({ where: { projectId: existing.id } });
    return existing;
  }

  return prisma.project.create({ data: { userId, name, description: 'Evaluation fixture' } });
};

const seedDocument = async (
  document: CorpusDocument,
  userId: string,
  projectId: number,
  idSuffix = '',
) => {
  const id = `eval-doc-${document.slug}${idSuffix}`;

  await prisma.document.create({
    data: {
      id,
      userId,
      projectId,
      originalName: document.originalName,
      storagePath: `eval/${document.slug}.pdf`,
      mimeType: document.mimeType,
      status: 'processed',
      extractedData: {
        docType: document.originalName.split(' - ')[0] ?? document.originalName,
        content: `Evaluation fixture for ${document.originalName}`,
        pages: document.pages,
      },
    },
  });

  const result = await ingestDocumentChunks(
    id,
    document.pages.map(page => ({ pageNumber: page.page, text: page.text })),
  );

  return { id, chunksCreated: result.chunksCreated };
};

export const seedEvalCorpus = async (): Promise<SeededCorpus> => {
  await upsertUser(EVAL_OWNER_ID, EVAL_OWNER_EMAIL, 'Eval Owner');
  await upsertUser(EVAL_INTRUDER_ID, EVAL_INTRUDER_EMAIL, 'Eval Intruder');

  const northside = await resetProject(EVAL_OWNER_ID, 'Northside Civil (eval)');
  const southbank = await resetProject(EVAL_OWNER_ID, 'Southbank Fitout (eval)');
  const intruderProject = await resetProject(EVAL_INTRUDER_ID, 'Other Tenant (eval)');

  const projectIds = { northside: northside.id, southbank: southbank.id };
  const documentIds = new Map<string, string>();

  let totalChunks = 0;
  for (const document of CORPUS) {
    const { id, chunksCreated } = await seedDocument(
      document,
      EVAL_OWNER_ID,
      projectIds[document.project],
    );
    documentIds.set(document.slug, id);
    totalChunks += chunksCreated;
    console.log(`  seeded ${document.originalName} (${chunksCreated} chunks)`);
  }

  // A second tenant holds a byte-identical copy of one document. Any retrieval
  // that returns this id has leaked across the access boundary, and because the
  // text is identical it will always rank highly if the filter is not applied.
  const leakCanary = CORPUS[0]!;
  const intruderDocument = await seedDocument(
    leakCanary,
    EVAL_INTRUDER_ID,
    intruderProject.id,
    '-intruder',
  );
  console.log(`  seeded cross-tenant copy of ${leakCanary.originalName} (leak canary)`);

  console.log(`\nSeeded ${CORPUS.length} documents, ${totalChunks} chunks.`);

  return {
    ownerId: EVAL_OWNER_ID,
    intruderId: EVAL_INTRUDER_ID,
    projectIds,
    documentIds,
    intruderDocumentId: intruderDocument.id,
  };
};

if (require.main === module) {
  seedEvalCorpus()
    .then(() => prisma.$disconnect())
    .catch(async error => {
      console.error('Seeding failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
