import type { LotoDraw, PairFrequencyRow } from "./types.js";

export function pairFrequencies(draws: LotoDraw[]): PairFrequencyRow[] {
  const counts = new Map<string, { pair: [number, number]; count: number }>();

  for (const draw of draws) {
    const nums = [...draw.numbers].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i += 1) {
      for (let j = i + 1; j < nums.length; j += 1) {
        const pair: [number, number] = [nums[i], nums[j]];
        const key = `${pair[0]}-${pair[1]}`;
        const previous = counts.get(key);
        counts.set(key, { pair, count: (previous?.count ?? 0) + 1 });
      }
    }
  }

  return [...counts.values()]
    .map(({ pair, count }) => ({
      pair,
      count,
      draws: draws.length,
      ratePerDraw: draws.length ? count / draws.length : 0
    }))
    .sort((a, b) => b.count - a.count || a.pair[0] - b.pair[0] || a.pair[1] - b.pair[1]);
}
