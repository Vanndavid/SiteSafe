// eval/corpus/index.ts
//
// A fixed corpus with known contents, so the evaluation has real gold labels.
//
// The `uploads/` directory in this repo is fifteen copies of the same 19KB PDF,
// which cannot support a 25-question retrieval eval. These fixtures stand in
// for it: they are written the way the vision extractor emits pages (one
// "Label: value" per line), so chunking, embedding, and retrieval see exactly
// the shape they see in production. Swapping in real extracted documents means
// replacing this file and the gold references in `dataset.ts`.

// Type-only in the other direction, so this pair does not form a runtime cycle.
import { DISTRACTOR_DOCUMENTS } from './distractors';

export type CorpusPage = {
  page: number;
  text: string;
};

export type CorpusDocument = {
  /** Stable slug used to build the seeded document id and the gold labels. */
  slug: string;
  originalName: string;
  mimeType: string;
  /**
   * Which project the document belongs to. Two projects exist so the eval can
   * check that project scoping does not leak.
   */
  project: 'northside' | 'southbank';
  /**
   * Marks fixtures written to imitate OCR of a scanned page: dropped
   * characters, broken words, confused digits. Used to compare retrieval on
   * scanned versus digital sources.
   */
  scanned?: boolean;
  pages: CorpusPage[];
};

/**
 * The documents the evaluation questions are answered from.
 *
 * Every gold label points into this list. `CORPUS` below adds the distractor
 * documents on top; keeping them separate makes it obvious which documents the
 * eval actually asserts against.
 */
export const GOLD_DOCUMENTS: CorpusDocument[] = [
  {
    slug: 'white-card-j-mercer',
    originalName: 'White Card - J Mercer.pdf',
    mimeType: 'application/pdf',
    project: 'northside',
    pages: [
      {
        page: 1,
        text: [
          'CONSTRUCTION INDUCTION TRAINING CARD',
          'General Construction Induction (White Card)',
          'Issued under the Work Health and Safety Regulation 2011',
          '',
          'Card Holder: Jordan Mercer',
          'Card Number: WC-4471-2290',
          'Date of Issue: 2023-03-14',
          'Expiry Date: 2027-03-14',
          'Issuing RTO: Safeworks Training Australia (RTO 41288)',
          'State of Issue: New South Wales',
          '',
          'This card certifies that the holder has completed CPCWHS1001 Prepare to work safely in the construction industry.',
          'The holder must carry this card on site at all times.',
          'A replacement card must be requested within 30 days of loss.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'public-liability-northside',
    originalName: 'Public Liability Certificate of Currency - Northside.pdf',
    mimeType: 'application/pdf',
    project: 'northside',
    pages: [
      {
        page: 1,
        text: [
          'CERTIFICATE OF CURRENCY',
          'Broadmoor Underwriting Group Pty Ltd',
          '',
          'Insured: Northside Civil Contracting Pty Ltd',
          'ABN: 62 114 887 002',
          'Policy Number: BLU-PL-889231',
          'Class of Policy: Broadform Public and Products Liability',
          '',
          'Period of Insurance',
          'From: 2025-07-01 at 4:00pm',
          'To: 2026-07-01 at 4:00pm',
          '',
          'Limit of Indemnity: AUD 20,000,000 any one occurrence',
          'Products Liability Aggregate: AUD 20,000,000 any one period of insurance',
        ].join('\n'),
      },
      {
        page: 2,
        text: [
          'SCHEDULE OF EXCESSES AND CONDITIONS',
          '',
          'Standard Excess: AUD 2,500 each and every claim',
          'Excess for claims arising from hot works: AUD 10,000 each and every claim',
          '',
          'Interested Parties Noted: Northside Development Trust',
          'Territorial Limits: Australia and New Zealand',
          '',
          'Endorsement 4 - Hot Works Warranty',
          'Hot works must cease no less than 60 minutes before the site is vacated, and a fire watch must be maintained for that period.',
          'Cover is excluded for any claim arising from hot works carried out without a completed hot works permit.',
          '',
          'This certificate is issued as a matter of information only and confers no rights upon the certificate holder.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'forklift-licence-a-nguyen',
    originalName: 'Forklift Licence - A Nguyen.pdf',
    mimeType: 'application/pdf',
    project: 'northside',
    pages: [
      {
        page: 1,
        text: [
          'LICENCE TO PERFORM HIGH RISK WORK',
          'SafeWork New South Wales',
          '',
          'Licence Holder: Amara Nguyen',
          'Licence Number: HRW-7781-3345',
          'Date of Birth: 1991-08-02',
          'Date of Issue: 2021-11-20',
          'Expiry Date: 2026-11-20',
          '',
          'Classes Authorised:',
          'LF - Forklift Truck',
          'LO - Order Picking Forklift Truck',
          '',
          'Conditions: Corrective lenses must be worn while operating.',
          'This licence remains the property of SafeWork NSW and must be produced on request.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'swms-crane-lift',
    originalName: 'SWMS - Tower Crane Lift Operations.pdf',
    mimeType: 'application/pdf',
    project: 'northside',
    pages: [
      {
        page: 1,
        text: [
          'SAFE WORK METHOD STATEMENT',
          'Activity: Tower Crane Lift Operations',
          'Document Number: SWMS-TC-014',
          'Revision: 3',
          'Date Prepared: 2025-02-10',
          'Prepared By: Priya Raman, Site Safety Manager',
          'Review Due: 2026-02-10',
          '',
          'Principal Contractor: Northside Civil Contracting Pty Ltd',
          'Site: Lot 14 Harbour Street, Sydney',
          '',
          'High Risk Construction Work Categories Applicable:',
          '- Work involving a risk of a person falling more than 2 metres',
          '- Work in an area with movement of powered mobile plant',
          '- Work involving structural alterations requiring temporary support',
        ].join('\n'),
      },
      {
        page: 2,
        text: [
          'CONTROL MEASURES',
          '',
          'Maximum wind speed for lifting operations is 36 kilometres per hour measured at the jib.',
          'All lifting must stop above this threshold and the load must be landed.',
          '',
          'Exclusion zone: a minimum radius of 1.5 times the load radius must be barricaded and marked, with a spotter stationed at each access point.',
          '',
          'Dogman and crane operator must maintain continuous two-way radio contact on channel 14.',
          'If radio contact is lost the lift is to be aborted and the load landed at the nearest safe position.',
          '',
          'Pre-start inspection of slings and shackles is required at the start of every shift and recorded in the lifting gear register.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'asbestos-awareness-d-okafor',
    originalName: 'Asbestos Awareness Certificate - D Okafor.pdf',
    mimeType: 'application/pdf',
    project: 'southbank',
    pages: [
      {
        page: 1,
        text: [
          'STATEMENT OF ATTAINMENT',
          'CPCCDE3014 Remove non-friable asbestos',
          '',
          'Student Name: Daniel Okafor',
          'Student Identifier: SI-2298-7741',
          'Completion Date: 2024-09-05',
          'Expiry Date: 2029-09-05',
          'Registered Training Organisation: Southbank Safety Institute (RTO 90210)',
          '',
          'Assessment Outcome: Competent',
          'This statement of attainment covers non-friable asbestos removal only.',
          'Friable asbestos removal requires a Class A licence and is not authorised by this qualification.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'workers-comp-southbank',
    originalName: 'Workers Compensation Policy - Southbank.pdf',
    mimeType: 'application/pdf',
    project: 'southbank',
    pages: [
      {
        page: 1,
        text: [
          'WORKERS COMPENSATION INSURANCE',
          'Certificate of Currency',
          '',
          'Employer: Southbank Fitout Group Pty Ltd',
          'ABN: 41 903 552 118',
          'Policy Number: WC-QLD-4410982',
          'Insurer: WorkCover Queensland',
          '',
          'Period of Cover',
          'From: 2025-10-01',
          'To: 2026-09-30',
          '',
          'Declared Wages for Period: AUD 3,420,000',
          'Industry Classification: 32410 - Building Installation Services',
          '',
          'Claims must be lodged within 6 months of the date of injury.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'electrical-licence-scanned',
    originalName: 'Electrical Contractor Licence - R Halloran (scanned).pdf',
    mimeType: 'application/pdf',
    project: 'southbank',
    scanned: true,
    pages: [
      {
        page: 1,
        text: [
          'ELECTFUCAL CONTRACTOR LICENCE',
          'Queenslarid Electrical Safety Office',
          '',
          'Licence l-lolder: Rhys Ha||oran',
          'Licence Nurnber: EC-3O92-118S',
          'Date of lssue: 2O24-O1-15',
          'Expiry Date: 2O27-O1-14',
          '',
          'Class: Electrical Contractor - unrestricted',
          'Nominee: R Ha||oran',
          '',
          'Conditions: Al| electrical work must be tested and a Certificate of Testing and Cornp|iance issued within 3O days of cornp|etion of the work.',
          'This |icence is not transferab|e.',
        ].join('\n'),
      },
    ],
  },
  {
    slug: 'site-induction-register',
    originalName: 'Site Induction Register - Southbank.pdf',
    mimeType: 'application/pdf',
    project: 'southbank',
    pages: [
      {
        page: 1,
        text: [
          'SITE INDUCTION REGISTER',
          'Site: 88 Grey Street, South Brisbane',
          'Principal Contractor: Southbank Fitout Group Pty Ltd',
          'Register Period: 2026-01-01 to 2026-06-30',
          '',
          'Inductions Recorded: 47',
          'Induction Validity: 12 months from date of induction',
          '',
          'All persons entering the site must complete a site-specific induction before first entry, in addition to holding a current construction induction card.',
          '',
          'Visitors who will be on site for less than 2 hours and remain escorted at all times may complete the abbreviated visitor induction instead.',
        ].join('\n'),
      },
    ],
  },
];

/**
 * Everything that gets indexed: the gold documents plus the near-duplicate
 * distractors that make a top-5 result mean something.
 */
export const CORPUS: CorpusDocument[] = [...GOLD_DOCUMENTS, ...DISTRACTOR_DOCUMENTS];

export const findDocument = (slug: string) => {
  const document = CORPUS.find(entry => entry.slug === slug);
  if (!document) {
    throw new Error(`Unknown corpus document: ${slug}`);
  }
  return document;
};
