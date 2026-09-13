import type { LotoDraw } from "./types.js";

export interface DuplicateProvenance {
  key: string;
  kept: { archive: string; entry: string };
  duplicate: { archive: string; entry: string };
}

export interface DedupeResult {
  draws: LotoDraw[];
  duplicates: DuplicateProvenance[];
}

export function canonicalDrawKey(draw: LotoDraw): string {
  return `${draw.date}|${draw.drawId}`;
}

function canonicalComparable(draw: LotoDraw): unknown {
  return {
    drawId: draw.drawId,
    drawNumber: draw.drawNumber,
    drawSequence: draw.drawSequence,
    date: draw.date,
    day: draw.day,
    ruleSet: draw.ruleSet,
    numbers: draw.numbers,
    sortedNumbers: draw.sortedNumbers,
    complementaryNumber: draw.complementaryNumber,
    chanceNumber: draw.chanceNumber,
    secondDraw: draw.secondDraw,
    prizeTiers: draw.prizeTiers,
    winningCodes: draw.winningCodes,
    currency: draw.currency
  };
}

export function canonicalDrawsEqual(a: LotoDraw, b: LotoDraw): boolean {
  return JSON.stringify(canonicalComparable(a)) === JSON.stringify(canonicalComparable(b));
}

export function dedupeDrawsStrict(draws: LotoDraw[]): DedupeResult {
  const byKey = new Map<string, LotoDraw>();
  const duplicates: DuplicateProvenance[] = [];

  for (const draw of draws) {
    const key = canonicalDrawKey(draw);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, draw);
      continue;
    }

    if (!canonicalDrawsEqual(existing, draw)) {
      throw new Error(
        `Conflicting duplicate draw ${key}: ` +
        `${existing.sourceArchive}/${existing.sourceEntry} != ` +
        `${draw.sourceArchive}/${draw.sourceEntry}`
      );
    }

    duplicates.push({
      key,
      kept: { archive: existing.sourceArchive, entry: existing.sourceEntry },
      duplicate: { archive: draw.sourceArchive, entry: draw.sourceEntry }
    });
  }

  return { draws: [...byKey.values()], duplicates };
}
