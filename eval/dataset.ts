// eval/dataset.ts
//
// The evaluation set. Two things are measured, separately:
//
//   Retrieval accuracy - did the chunk that actually contains the answer appear
//                        in the top 5?
//   Answer accuracy    - was the final answer right?
//
// They are kept apart because they fail for different reasons and have
// different fixes. An answer can be wrong because retrieval never surfaced the
// right passage (fix the index), or because the model was handed the right
// passage and still got it wrong (fix the prompt). A single blended score
// cannot tell you which, which is the whole reason for running an eval rather
// than eyeballing a few queries.

export type EvalCase = {
  id: string;
  question: string;
  /**
   * Where the answer lives. Chunk ids are assigned at seed time, so the gold
   * label is the (document, page) pair that a correct chunk must come from.
   * Null means no chunk is correct - the documents do not answer this.
   */
  gold: { documentSlug: string; pageNumber: number } | null;
  /**
   * Substrings the answer must contain, compared case-insensitively with
   * punctuation and whitespace normalised. Grading this way is stricter than a
   * model judge on facts (a date is either right or it is not) and looser on
   * phrasing, which is the correct trade for compliance answers where the
   * number matters and the sentence around it does not.
   */
  expectedAnswerContains: string[];
  /** True when the honest answer is "not found in your documents". */
  unanswerable?: boolean;
  /** Free-text note explaining why a case is interesting. */
  note?: string;
};

export const EVAL_CASES: EvalCase[] = [
  // --- Single-value lookups: the bread-and-butter compliance question -------
  {
    id: 'q01',
    question: "When does Jordan Mercer's white card expire?",
    gold: { documentSlug: 'white-card-j-mercer', pageNumber: 1 },
    expectedAnswerContains: ['2027-03-14'],
  },
  {
    id: 'q02',
    question: "What is the card number on Jordan Mercer's white card?",
    gold: { documentSlug: 'white-card-j-mercer', pageNumber: 1 },
    expectedAnswerContains: ['WC-4471-2290'],
  },
  {
    id: 'q03',
    question: "Which training organisation issued Jordan Mercer's white card?",
    gold: { documentSlug: 'white-card-j-mercer', pageNumber: 1 },
    expectedAnswerContains: ['Safeworks Training Australia'],
  },
  {
    id: 'q04',
    question: "What is the limit of indemnity on Northside Civil Contracting's public liability policy?",
    gold: { documentSlug: 'public-liability-northside', pageNumber: 1 },
    expectedAnswerContains: ['20,000,000'],
  },
  {
    id: 'q05',
    question: "What is Northside's public liability policy number?",
    gold: { documentSlug: 'public-liability-northside', pageNumber: 1 },
    expectedAnswerContains: ['BLU-PL-889231'],
    note: 'Alphanumeric identifier - the case vector search is worst at and keyword search is best at.',
  },
  {
    id: 'q06',
    question: "When does Northside Civil Contracting's public liability cover expire?",
    gold: { documentSlug: 'public-liability-northside', pageNumber: 1 },
    expectedAnswerContains: ['2026-07-01'],
  },
  {
    id: 'q07',
    question: "What is the excess for a hot works claim on the Northside public liability policy?",
    gold: { documentSlug: 'public-liability-northside', pageNumber: 2 },
    expectedAnswerContains: ['10,000'],
    note: 'Page 2 of a two-page document; distinguishes the standard excess from the hot works excess.',
  },
  {
    id: 'q08',
    question: 'How long must a fire watch be kept after hot works finish?',
    gold: { documentSlug: 'public-liability-northside', pageNumber: 2 },
    expectedAnswerContains: ['60 minutes'],
  },
  {
    id: 'q09',
    question: 'What forklift classes is Amara Nguyen licensed for?',
    gold: { documentSlug: 'forklift-licence-a-nguyen', pageNumber: 1 },
    expectedAnswerContains: ['LF', 'LO'],
  },
  {
    id: 'q10',
    question: "When does Amara Nguyen's high risk work licence expire?",
    gold: { documentSlug: 'forklift-licence-a-nguyen', pageNumber: 1 },
    expectedAnswerContains: ['2026-11-20'],
  },
  {
    id: 'q11',
    question: "Are there any conditions on Amara Nguyen's forklift licence?",
    gold: { documentSlug: 'forklift-licence-a-nguyen', pageNumber: 1 },
    expectedAnswerContains: ['corrective lenses'],
  },

  // --- Procedural questions: answers are sentences, not field values -------
  {
    id: 'q12',
    question: 'What is the maximum wind speed for crane lifting operations?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 2 },
    expectedAnswerContains: ['36'],
  },
  {
    id: 'q13',
    question: 'What radio channel do the dogman and crane operator use?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 2 },
    expectedAnswerContains: ['14'],
  },
  {
    id: 'q14',
    question: 'What should happen if radio contact is lost during a lift?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 2 },
    expectedAnswerContains: ['abort'],
  },
  {
    id: 'q15',
    question: 'How large does the crane exclusion zone need to be?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 2 },
    expectedAnswerContains: ['1.5'],
  },
  {
    id: 'q16',
    question: 'Who prepared the tower crane safe work method statement?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 1 },
    expectedAnswerContains: ['Priya Raman'],
  },
  {
    id: 'q17',
    question: 'When is the tower crane SWMS due for review?',
    gold: { documentSlug: 'swms-crane-lift', pageNumber: 1 },
    expectedAnswerContains: ['2026-02-10'],
    note: 'Two dates on the same page (prepared vs review due) - tests whether the model picks the right one.',
  },
  {
    id: 'q18',
    question: "Does Daniel Okafor's asbestos certificate cover friable asbestos?",
    gold: { documentSlug: 'asbestos-awareness-d-okafor', pageNumber: 1 },
    expectedAnswerContains: ['non-friable'],
    note: 'The correct answer is a negation. Retrieval is easy; the model has to not say yes.',
  },
  {
    id: 'q19',
    question: 'When does the asbestos removal qualification expire?',
    gold: { documentSlug: 'asbestos-awareness-d-okafor', pageNumber: 1 },
    expectedAnswerContains: ['2029-09-05'],
  },
  {
    id: 'q20',
    question: 'What is the workers compensation policy number for Southbank Fitout Group?',
    gold: { documentSlug: 'workers-comp-southbank', pageNumber: 1 },
    expectedAnswerContains: ['WC-QLD-4410982'],
  },
  {
    id: 'q21',
    question: 'What were the declared wages on the Southbank Fitout workers compensation policy?',
    gold: { documentSlug: 'workers-comp-southbank', pageNumber: 1 },
    expectedAnswerContains: ['3,420,000'],
  },
  {
    id: 'q22',
    question: 'How long does an injured worker have to lodge a claim under the Southbank Fitout workers compensation policy?',
    gold: { documentSlug: 'workers-comp-southbank', pageNumber: 1 },
    expectedAnswerContains: ['6 months'],
  },
  {
    id: 'q23',
    question: "When does Rhys Halloran's electrical contractor licence expire?",
    gold: { documentSlug: 'electrical-licence-scanned', pageNumber: 1 },
    expectedAnswerContains: ['2027-01-14'],
    note: 'Scanned fixture: the date is OCR-mangled to "2O27-O1-14" with letter O for zero.',
  },
  {
    id: 'q24',
    question: 'How long is a site induction valid for?',
    gold: { documentSlug: 'site-induction-register', pageNumber: 1 },
    expectedAnswerContains: ['12 months'],
  },
  {
    id: 'q25',
    question: 'Can a short visit avoid the full site induction?',
    gold: { documentSlug: 'site-induction-register', pageNumber: 1 },
    expectedAnswerContains: ['2 hours'],
  },

  // --- Unanswerable: the documents genuinely do not cover these ------------
  // Without these, a system that answered every question confidently would
  // score the same as one that knew its limits.
  {
    id: 'q26',
    question: 'What is the excess on the Southbank Fitout workers compensation policy?',
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: 'An excess exists on the public liability policy but not this one. Tests cross-document confusion.',
  },
  {
    id: 'q27',
    question: "Who is Jordan Mercer's emergency contact?",
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: "Retrieval will confidently return the white card; the right answer is still 'not found'.",
  },
  {
    id: 'q28',
    question: 'What is the maximum hook height of the tower crane?',
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: 'The SWMS gives a wind limit and an exclusion zone but never a hook height.',
  },
  {
    id: 'q29',
    question: 'Does Northside hold professional indemnity insurance?',
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: 'A different class of policy to the one on file. Tempting to answer from the public liability certificate.',
  },
  {
    id: 'q30',
    question: "What is Amara Nguyen's residential address?",
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: 'The licence carries a date of birth but no address.',
  },
  {
    id: 'q31',
    question: 'When was the last asbestos air monitoring test carried out?',
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
  },
  {
    id: 'q32',
    question: 'What is the penalty for working without a white card in Queensland?',
    gold: null,
    expectedAnswerContains: [],
    unanswerable: true,
    note: 'Answerable from general knowledge but not from these documents - catches the model falling back on its training.',
  },
];

export const ANSWERABLE_CASES = EVAL_CASES.filter(evalCase => !evalCase.unanswerable);
export const UNANSWERABLE_CASES = EVAL_CASES.filter(evalCase => evalCase.unanswerable);
