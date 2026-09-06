import { chunkDocument, estimateTokens, splitIntoSegments } from '../utils/chunker';

describe('splitIntoSegments', () => {
  it('splits on sentence boundaries and newlines', () => {
    const segments = splitIntoSegments('Card Holder: Jordan Mercer\nExpiry Date: 2027-03-14');
    expect(segments).toEqual(['Card Holder: Jordan Mercer', 'Expiry Date: 2027-03-14']);
  });

  it('drops blank lines', () => {
    expect(splitIntoSegments('one\n\n\ntwo')).toEqual(['one', 'two']);
  });
});

describe('chunkDocument', () => {
  const buildPage = (pageNumber: number, lineCount: number) => ({
    pageNumber,
    // Each line is ~60 characters, so ~15 tokens under the 4-chars-per-token
    // estimate. 60 lines is comfortably past a 500-token target.
    text: Array.from({ length: lineCount }, (_, i) => `Line ${i} of page ${pageNumber} padded out to sixty chars.`).join('\n'),
  });

  it('keeps a short document as a single chunk', () => {
    const chunks = chunkDocument([{ pageNumber: 1, text: 'Expiry Date: 2027-03-14' }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('Expiry Date: 2027-03-14');
    expect(chunks[0]!.pageNumber).toBe(1);
  });

  it('splits long pages into multiple chunks near the target size', () => {
    const chunks = chunkDocument([buildPage(1, 120)], { targetTokens: 500, overlapTokens: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Overlap is added on top of the target, so allow headroom above it.
      expect(chunk.tokenCount).toBeLessThanOrEqual(560);
    }
  });

  it('never lets a chunk span two pages', () => {
    const chunks = chunkDocument([buildPage(1, 60), buildPage(2, 60)]);

    expect(chunks.some(chunk => chunk.pageNumber === 1)).toBe(true);
    expect(chunks.some(chunk => chunk.pageNumber === 2)).toBe(true);

    for (const chunk of chunks) {
      const mentionsPageOne = chunk.content.includes('of page 1');
      const mentionsPageTwo = chunk.content.includes('of page 2');
      expect(mentionsPageOne && mentionsPageTwo).toBe(false);
    }
  });

  it('repeats trailing context in the next chunk', () => {
    const chunks = chunkDocument([buildPage(1, 120)], { targetTokens: 200, overlapTokens: 50 });
    expect(chunks.length).toBeGreaterThan(1);

    const first = chunks[0]!;
    const second = chunks[1]!;
    const tailOfFirst = first.content.split(' ').slice(-6).join(' ');

    expect(second.content).toContain(tailOfFirst);
  });

  it('numbers chunks continuously across pages', () => {
    const chunks = chunkDocument([buildPage(1, 60), buildPage(2, 60)]);
    expect(chunks.map(chunk => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
  });

  it('keeps an oversized single line intact rather than cutting it mid-value', () => {
    const longLine = `Endorsement: ${'x'.repeat(4000)}`;
    const chunks = chunkDocument([{ pageNumber: 1, text: longLine }], { targetTokens: 500 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(longLine);
  });

  it('ignores empty pages', () => {
    const chunks = chunkDocument([
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: 'Expiry Date: 2026-11-20' },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageNumber).toBe(2);
  });

  it('estimates tokens from character length', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });
});
