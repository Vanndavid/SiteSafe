// src/utils/rankFusion.ts
// Reciprocal Rank Fusion, used to merge the vector and keyword result lists
// into the single ranking that hybrid search returns.

export type RankedItem = {
  id: string;
};

export type FusedItem<T extends RankedItem> = {
  item: T;
  score: number;
  ranks: Record<string, number>;
};

// Standard RRF constant. A larger k flattens the curve so a top hit in one
// ranker cannot single-handedly dominate the merged list; 60 is the value from
// the original Cormack et al. paper and the usual default.
export const RRF_K = 60;

/**
 * Merge several ranked lists into one.
 *
 * RRF only reads each document's *rank* within a list, never its raw score.
 * That matters here because cosine similarity (0..1) and Postgres
 * `ts_rank_cd` (unbounded, corpus-dependent) are not on comparable scales, so
 * any weighted sum of the two would need per-corpus tuning to behave.
 */
export const reciprocalRankFusion = <T extends RankedItem>(
  lists: Record<string, T[]>,
  k: number = RRF_K,
): FusedItem<T>[] => {
  const accumulator = new Map<string, FusedItem<T>>();

  for (const [listName, items] of Object.entries(lists)) {
    items.forEach((item, index) => {
      const rank = index + 1;
      const existing = accumulator.get(item.id);

      if (existing) {
        existing.score += 1 / (k + rank);
        existing.ranks[listName] = rank;
        return;
      }

      accumulator.set(item.id, {
        item,
        score: 1 / (k + rank),
        ranks: { [listName]: rank },
      });
    });
  }

  return Array.from(accumulator.values()).sort((a, b) => b.score - a.score);
};
