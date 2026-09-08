import type { LotoDraw } from "./types.js";

export function pairFrequencies(draws: LotoDraw[]) {
  const counts = new Map<string, number>();

  for (const draw of draws) {
    const nums = [...draw.numbers].sort((a, b) => a - b);

    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]}-${nums[j]}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair));
}
