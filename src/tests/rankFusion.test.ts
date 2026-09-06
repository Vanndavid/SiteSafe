import { reciprocalRankFusion, RRF_K } from '../utils/rankFusion';

const item = (id: string) => ({ id });

describe('reciprocalRankFusion', () => {
  it('ranks a chunk found by both rankers above one found by only one', () => {
    const fused = reciprocalRankFusion({
      vector: [item('a'), item('b')],
      keyword: [item('c'), item('a')],
    });

    expect(fused[0]!.item.id).toBe('a');
    expect(fused[0]!.ranks).toEqual({ vector: 1, keyword: 2 });
  });

  it('surfaces a chunk that only the keyword ranker found', () => {
    // The exact-identifier case: vector search buries the policy number, the
    // keyword index puts it first, and fusion has to let it through.
    const fused = reciprocalRankFusion({
      vector: [item('v1'), item('v2'), item('v3'), item('v4'), item('v5')],
      keyword: [item('policy-chunk')],
    });

    expect(fused.slice(0, 2).map(entry => entry.item.id)).toContain('policy-chunk');
  });

  it('scores by rank only, never by the ranker raw score', () => {
    const fused = reciprocalRankFusion({ vector: [item('a')] });
    expect(fused[0]!.score).toBeCloseTo(1 / (RRF_K + 1));
  });

  it('returns an empty list when every ranker is empty', () => {
    expect(reciprocalRankFusion({ vector: [], keyword: [] })).toEqual([]);
  });

  it('handles a single ranker returning results', () => {
    const fused = reciprocalRankFusion({ vector: [item('a'), item('b')], keyword: [] });
    expect(fused.map(entry => entry.item.id)).toEqual(['a', 'b']);
  });

  it('is stable when both rankers agree exactly', () => {
    const fused = reciprocalRankFusion({
      vector: [item('a'), item('b'), item('c')],
      keyword: [item('a'), item('b'), item('c')],
    });

    expect(fused.map(entry => entry.item.id)).toEqual(['a', 'b', 'c']);
  });
});
