import type { LotoDraw } from "./types.js";

export function numberFrequencies(draws: LotoDraw[]) {
  const frequencies = new Map<number, number>();

  for (const draw of draws) {
    for (const number of draw.numbers) {
      frequencies.set(number, (frequencies.get(number) ?? 0) + 1);
    }
  }

  return [...frequencies.entries()]
    .map(([number, count]) => ({ number, count }))
    .sort((a, b) => b.count - a.count || a.number - b.number);
}
