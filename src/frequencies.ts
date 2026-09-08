import type { FrequencyRow, LotoDraw } from "./types.js";

export function frequencyTable(draws: LotoDraw[], values: (draw: LotoDraw) => number[]): FrequencyRow[] {
  const counts = new Map<number, number>();
  const lastIndex = new Map<number, number>();
  const lastDate = new Map<number, string>();

  draws.forEach((draw, index) => {
    for (const number of values(draw)) {
      counts.set(number, (counts.get(number) ?? 0) + 1);
      lastIndex.set(number, index);
      lastDate.set(number, draw.date);
    }
  });

  return [...counts.keys()]
    .sort((a, b) => a - b)
    .map((number) => ({
      number,
      count: counts.get(number) ?? 0,
      draws: draws.length,
      ratePerDraw: draws.length ? (counts.get(number) ?? 0) / draws.length : 0,
      lastSeenDate: lastDate.get(number) ?? null,
      delayInDraws: lastIndex.has(number) ? draws.length - 1 - (lastIndex.get(number) ?? 0) : null
    }));
}

export function numberFrequencies(draws: LotoDraw[]): FrequencyRow[] {
  return frequencyTable(draws, (draw) => draw.numbers);
}
