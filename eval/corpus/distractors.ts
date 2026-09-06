// eval/corpus/distractors.ts
//
// Near-duplicate documents that exist purely to make retrieval hard.
//
// Why this file exists: with only the eight gold documents seeded, the whole
// index is ten chunks and a top-5 retrieval returns half of everything. A
// retriever that ranked at random would score around 50%, so no measurement
// taken against it would mean anything.
//
// The distractors are deliberately the *same kinds* of document as the gold
// set - more white cards, more licences, more certificates of currency - for
// different people and companies. That is the shape of a real compliance
// corpus, and it is the case that actually breaks naive retrieval: asking
// about one worker's expiry date when thirty other workers hold the same card
// type with the same field labels and different dates.
//
// They are constrained so they cannot corrupt the gold labels:
//   - no distractor mentions hot works, crane lifts, asbestos, or inductions
//   - no workers compensation distractor carries an excess (q26 must stay
//     unanswerable)
//   - no distractor repeats a gold holder name, entity, or identifier

import type { CorpusDocument } from './index';

type Holder = {
  name: string;
  cardNumber: string;
  issue: string;
  expiry: string;
  rto: string;
  project: CorpusDocument['project'];
};

const WHITE_CARD_HOLDERS: Holder[] = [
  { name: 'Tomas Beck', cardNumber: 'WC-1180-4417', issue: '2022-06-02', expiry: '2026-06-02', rto: 'Gateway Skills Group (RTO 30117)', project: 'northside' },
  { name: 'Yusra Haddad', cardNumber: 'WC-9034-2210', issue: '2024-02-19', expiry: '2028-02-19', rto: 'Gateway Skills Group (RTO 30117)', project: 'northside' },
  { name: 'Callum Fraser', cardNumber: 'WC-6621-8890', issue: '2021-10-11', expiry: '2025-10-11', rto: 'Trade Ready Institute (RTO 45902)', project: 'northside' },
  { name: 'Nadia Petrov', cardNumber: 'WC-3345-7712', issue: '2023-08-30', expiry: '2027-08-30', rto: 'Trade Ready Institute (RTO 45902)', project: 'southbank' },
  { name: 'Hemi Walker', cardNumber: 'WC-7788-1123', issue: '2025-01-07', expiry: '2029-01-07', rto: 'Southbank Safety Institute (RTO 90210)', project: 'southbank' },
  { name: 'Grace Ojo', cardNumber: 'WC-2299-6640', issue: '2022-11-23', expiry: '2026-11-23', rto: 'Southbank Safety Institute (RTO 90210)', project: 'southbank' },
  { name: 'Liam Cassidy', cardNumber: 'WC-5510-3308', issue: '2024-07-16', expiry: '2028-07-16', rto: 'Gateway Skills Group (RTO 30117)', project: 'northside' },
  { name: 'Priya Anand', cardNumber: 'WC-8802-9945', issue: '2023-04-04', expiry: '2027-04-04', rto: 'Trade Ready Institute (RTO 45902)', project: 'southbank' },
  { name: 'Marcus Vella', cardNumber: 'WC-4417-2201', issue: '2021-12-13', expiry: '2025-12-13', rto: 'Gateway Skills Group (RTO 30117)', project: 'northside' },
  { name: 'Sione Tui', cardNumber: 'WC-6690-5523', issue: '2025-03-28', expiry: '2029-03-28', rto: 'Southbank Safety Institute (RTO 90210)', project: 'southbank' },
];

const buildWhiteCard = (holder: Holder): CorpusDocument => ({
  slug: `white-card-${holder.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  originalName: `White Card - ${holder.name}.pdf`,
  mimeType: 'application/pdf',
  project: holder.project,
  pages: [
    {
      page: 1,
      text: [
        'CONSTRUCTION INDUCTION TRAINING CARD',
        'General Construction Induction (White Card)',
        'Issued under the Work Health and Safety Regulation 2011',
        '',
        `Card Holder: ${holder.name}`,
        `Card Number: ${holder.cardNumber}`,
        `Date of Issue: ${holder.issue}`,
        `Expiry Date: ${holder.expiry}`,
        `Issuing RTO: ${holder.rto}`,
        'State of Issue: New South Wales',
        '',
        'This card certifies that the holder has completed CPCWHS1001 Prepare to work safely in the construction industry.',
        'The holder must carry this card on site at all times.',
        'A replacement card must be requested within 30 days of loss.',
      ].join('\n'),
    },
  ],
});

type HighRiskLicence = {
  name: string;
  licenceNumber: string;
  dob: string;
  issue: string;
  expiry: string;
  classes: string[];
  condition: string;
  project: CorpusDocument['project'];
};

const HIGH_RISK_LICENCES: HighRiskLicence[] = [
  { name: 'Devin Marsh', licenceNumber: 'HRW-2201-9987', dob: '1988-04-17', issue: '2022-05-09', expiry: '2027-05-09', classes: ['DG - Dogging', 'RB - Basic Rigging'], condition: 'Nil', project: 'northside' },
  { name: 'Aroha Kepa', licenceNumber: 'HRW-5563-2018', dob: '1995-12-01', issue: '2023-09-22', expiry: '2028-09-22', classes: ['CN - Non-slewing Mobile Crane'], condition: 'Nil', project: 'northside' },
  { name: 'Owen Bradley', licenceNumber: 'HRW-9910-4432', dob: '1979-07-25', issue: '2021-03-15', expiry: '2026-03-15', classes: ['SB - Basic Scaffolding'], condition: 'Hearing protection required.', project: 'southbank' },
  { name: 'Farida Hassan', licenceNumber: 'HRW-3378-6604', dob: '1992-02-09', issue: '2024-11-04', expiry: '2029-11-04', classes: ['EWP - Elevating Work Platform'], condition: 'Nil', project: 'southbank' },
  { name: 'Blake Rennie', licenceNumber: 'HRW-7742-1156', dob: '1986-10-30', issue: '2020-08-18', expiry: '2025-08-18', classes: ['LF - Forklift Truck'], condition: 'Nil', project: 'southbank' },
  { name: 'Ines Duarte', licenceNumber: 'HRW-6015-8823', dob: '1990-06-12', issue: '2025-02-27', expiry: '2030-02-27', classes: ['CT - Tower Crane'], condition: 'Nil', project: 'northside' },
];

const buildHighRiskLicence = (licence: HighRiskLicence): CorpusDocument => ({
  slug: `hrw-licence-${licence.name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
  originalName: `High Risk Work Licence - ${licence.name}.pdf`,
  mimeType: 'application/pdf',
  project: licence.project,
  pages: [
    {
      page: 1,
      text: [
        'LICENCE TO PERFORM HIGH RISK WORK',
        'SafeWork New South Wales',
        '',
        `Licence Holder: ${licence.name}`,
        `Licence Number: ${licence.licenceNumber}`,
        `Date of Birth: ${licence.dob}`,
        `Date of Issue: ${licence.issue}`,
        `Expiry Date: ${licence.expiry}`,
        '',
        'Classes Authorised:',
        ...licence.classes,
        '',
        `Conditions: ${licence.condition}`,
        'This licence remains the property of SafeWork NSW and must be produced on request.',
      ].join('\n'),
    },
  ],
});

type LiabilityPolicy = {
  insured: string;
  abn: string;
  policyNumber: string;
  from: string;
  to: string;
  limit: string;
  excess: string;
  project: CorpusDocument['project'];
};

// No hot works endorsement on any of these - that clause is unique to the gold
// Northside certificate and q07/q08 depend on it staying that way.
const LIABILITY_POLICIES: LiabilityPolicy[] = [
  { insured: 'Harbour Line Scaffolding Pty Ltd', abn: '88 220 411 907', policyNumber: 'BLU-PL-114876', from: '2025-04-01', to: '2026-04-01', limit: 'AUD 10,000,000', excess: 'AUD 1,000', project: 'northside' },
  { insured: 'Meridian Concrete Services Pty Ltd', abn: '19 664 300 552', policyNumber: 'AXR-PL-772140', from: '2025-09-15', to: '2026-09-15', limit: 'AUD 5,000,000', excess: 'AUD 2,000', project: 'northside' },
  { insured: 'Grey Street Glazing Pty Ltd', abn: '73 118 992 044', policyNumber: 'QBX-PL-330918', from: '2026-01-20', to: '2027-01-20', limit: 'AUD 20,000,000', excess: 'AUD 5,000', project: 'southbank' },
  { insured: 'Delta Plumbing Group Pty Ltd', abn: '55 402 776 130', policyNumber: 'BLU-PL-556201', from: '2025-11-30', to: '2026-11-30', limit: 'AUD 10,000,000', excess: 'AUD 2,500', project: 'southbank' },
];

const buildLiabilityPolicy = (policy: LiabilityPolicy): CorpusDocument => ({
  slug: `public-liability-${policy.policyNumber.toLowerCase()}`,
  originalName: `Public Liability Certificate of Currency - ${policy.insured.split(' ')[0]}.pdf`,
  mimeType: 'application/pdf',
  project: policy.project,
  pages: [
    {
      page: 1,
      text: [
        'CERTIFICATE OF CURRENCY',
        'Broadmoor Underwriting Group Pty Ltd',
        '',
        `Insured: ${policy.insured}`,
        `ABN: ${policy.abn}`,
        `Policy Number: ${policy.policyNumber}`,
        'Class of Policy: Broadform Public and Products Liability',
        '',
        'Period of Insurance',
        `From: ${policy.from} at 4:00pm`,
        `To: ${policy.to} at 4:00pm`,
        '',
        `Limit of Indemnity: ${policy.limit} any one occurrence`,
        `Standard Excess: ${policy.excess} each and every claim`,
        'Territorial Limits: Australia and New Zealand',
      ].join('\n'),
    },
  ],
});

type WorkersCompPolicy = {
  employer: string;
  abn: string;
  policyNumber: string;
  insurer: string;
  from: string;
  to: string;
  wages: string;
  project: CorpusDocument['project'];
};

// No excess line on any of these: q26 asks for the excess on a workers
// compensation policy and must stay unanswerable.
const WORKERS_COMP_POLICIES: WorkersCompPolicy[] = [
  { employer: 'Harbour Line Scaffolding Pty Ltd', abn: '88 220 411 907', policyNumber: 'WC-NSW-2201883', insurer: 'icare NSW', from: '2025-06-30', to: '2026-06-29', wages: 'AUD 1,180,000', project: 'northside' },
  { employer: 'Meridian Concrete Services Pty Ltd', abn: '19 664 300 552', policyNumber: 'WC-NSW-7740126', insurer: 'icare NSW', from: '2025-08-01', to: '2026-07-31', wages: 'AUD 2,640,000', project: 'northside' },
  { employer: 'Grey Street Glazing Pty Ltd', abn: '73 118 992 044', policyNumber: 'WC-QLD-9903471', insurer: 'WorkCover Queensland', from: '2026-02-01', to: '2027-01-31', wages: 'AUD 890,000', project: 'southbank' },
];

const buildWorkersComp = (policy: WorkersCompPolicy): CorpusDocument => ({
  slug: `workers-comp-${policy.policyNumber.toLowerCase()}`,
  originalName: `Workers Compensation Policy - ${policy.employer.split(' ')[0]}.pdf`,
  mimeType: 'application/pdf',
  project: policy.project,
  pages: [
    {
      page: 1,
      text: [
        'WORKERS COMPENSATION INSURANCE',
        'Certificate of Currency',
        '',
        `Employer: ${policy.employer}`,
        `ABN: ${policy.abn}`,
        `Policy Number: ${policy.policyNumber}`,
        `Insurer: ${policy.insurer}`,
        '',
        'Period of Cover',
        `From: ${policy.from}`,
        `To: ${policy.to}`,
        '',
        `Declared Wages for Period: ${policy.wages}`,
        'Industry Classification: 32410 - Building Installation Services',
        '',
        'Claims must be lodged within 6 months of the date of injury.',
      ].join('\n'),
    },
  ],
});

export const DISTRACTOR_DOCUMENTS: CorpusDocument[] = [
  ...WHITE_CARD_HOLDERS.map(buildWhiteCard),
  ...HIGH_RISK_LICENCES.map(buildHighRiskLicence),
  ...LIABILITY_POLICIES.map(buildLiabilityPolicy),
  ...WORKERS_COMP_POLICIES.map(buildWorkersComp),
];
