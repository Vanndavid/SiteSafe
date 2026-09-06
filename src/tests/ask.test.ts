import request from 'supertest';
import app from '../server';
import { bearerAuthHeader } from './helpers/auth';

jest.mock('../services/ragAnswerService', () => ({
  askDocuments: jest.fn(),
  NOT_FOUND_ANSWER: 'Not found in your documents.',
}));

jest.mock('../services/usagePolicyService', () => ({
  enforceAskPolicy: jest.fn(),
}));

import { askDocuments } from '../services/ragAnswerService';
import { enforceAskPolicy } from '../services/usagePolicyService';
import { HttpError } from '../utils/httpError';

const mockedAskDocuments = askDocuments as jest.MockedFunction<typeof askDocuments>;
const mockedEnforceAskPolicy = enforceAskPolicy as jest.MockedFunction<typeof enforceAskPolicy>;

const answerFixture = {
  question: 'When does the white card expire?',
  answer: 'The white card expires on 2027-03-14.',
  answered: true,
  citations: [
    {
      documentId: 'doc-1',
      documentName: 'White Card - J Mercer.pdf',
      pageNumber: 1,
      chunkId: 'chunk-1',
    },
  ],
  retrieval: { mode: 'hybrid' as const, chunkIds: ['chunk-1'] },
};

describe('POST /api/ask', () => {
  it('answers a question with citations', async () => {
    mockedAskDocuments.mockResolvedValue(answerFixture);

    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toContain('2027-03-14');
    expect(res.body.citations).toHaveLength(1);
    expect(res.body.citations[0].pageNumber).toBe(1);
  });

  it('scopes retrieval to the authenticated user', async () => {
    mockedAskDocuments.mockResolvedValue(answerFixture);

    await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?', projectId: 7 });

    expect(mockedAskDocuments).toHaveBeenCalledWith(
      'When does the white card expire?',
      expect.objectContaining({ userId: 'test_user_123', projectId: 7 }),
    );
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/ask').send({ question: 'anything' });

    expect(res.status).toBe(401);
    expect(mockedAskDocuments).not.toHaveBeenCalled();
  });

  it('rejects an empty question', async () => {
    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: '   ' });

    expect(res.status).toBe(400);
    expect(mockedAskDocuments).not.toHaveBeenCalled();
  });

  it('rejects an over-long question', async () => {
    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'a'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('passes through the not-found answer without inventing citations', async () => {
    mockedAskDocuments.mockResolvedValue({
      question: 'What is the crane hook height?',
      answer: 'Not found in your documents.',
      answered: false,
      citations: [],
      retrieval: { mode: 'hybrid', chunkIds: ['chunk-9'] },
    });

    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'What is the crane hook height?' });

    expect(res.status).toBe(200);
    expect(res.body.answered).toBe(false);
    expect(res.body.citations).toEqual([]);
  });

  it('ignores an unrecognised retrieval mode rather than passing it through', async () => {
    mockedAskDocuments.mockResolvedValue(answerFixture);

    await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?', mode: 'sql-injection' });

    const options = mockedAskDocuments.mock.calls[0]![1];
    expect(options).not.toHaveProperty('mode');
  });

  it('enforces the usage policy before spending any Gemini calls', async () => {
    mockedAskDocuments.mockResolvedValue(answerFixture);

    await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?' });

    expect(mockedEnforceAskPolicy).toHaveBeenCalledWith('test_user_123', expect.anything());
  });

  it('rejects a blocked account without calling the model', async () => {
    mockedEnforceAskPolicy.mockRejectedValue(
      new HttpError(403, 'Your account is not allowed to use AI features.'),
    );

    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not allowed');
    expect(mockedAskDocuments).not.toHaveBeenCalled();
  });

  it('surfaces a quota rejection as 429 rather than 500', async () => {
    mockedEnforceAskPolicy.mockRejectedValue(new HttpError(429, 'Daily quota reached.'));

    const res = await request(app)
      .post('/api/ask')
      .set(bearerAuthHeader())
      .send({ question: 'When does the white card expire?' });

    expect(res.status).toBe(429);
    expect(mockedAskDocuments).not.toHaveBeenCalled();
  });
});
