import type { LotoDraw, PrizeTier } from "./types.js";

export interface ValidationIssue {
  level: "error" | "warning";
  drawId?: string;
  date?: string;
  message: string;
}

function allUnique(values: number[]): boolean {
  return new Set(values).size === values.length;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function expectedSorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function normalizedWeekday(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const aliases: Record<string, string> = {
    di: "dimanche",
    dim: "dimanche",
    dimanche: "dimanche",
    lu: "lundi",
    lun: "lundi",
    lundi: "lundi",
    ma: "mardi",
    mar: "mardi",
    mardi: "mardi",
    me: "mercredi",
    mer: "mercredi",
    mercredi: "mercredi",
    je: "jeudi",
    jeu: "jeudi",
    jeudi: "jeudi",
    ve: "vendredi",
    ven: "vendredi",
    vendredi: "vendredi",
    sa: "samedi",
    sam: "samedi",
    samedi: "samedi"
  };

  return aliases[normalized] ?? normalized;
}

function weekdayForDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][parsed.getUTCDay()];
}

function validatePrizeTiers(
  tiers: PrizeTier[],
  issue: (level: "error" | "warning", message: string) => void,
  label: string
): void {
  const ranks = new Set<number>();

  for (const tier of tiers) {
    if (!Number.isInteger(tier.rank) || tier.rank <= 0) issue("error", `${label}: invalid rank ${tier.rank}`);
    if (ranks.has(tier.rank)) issue("error", `${label}: duplicate rank ${tier.rank}`);
    ranks.add(tier.rank);

    if (tier.winners !== null && (!Number.isInteger(tier.winners) || tier.winners < 0)) {
      issue("error", `${label}: invalid winners at rank ${tier.rank}`);
    }

    if (tier.payout !== null && (!Number.isFinite(tier.payout) || tier.payout < 0)) {
      issue("error", `${label}: invalid payout at rank ${tier.rank}`);
    }
  }
}

export function validateDraw(draw: LotoDraw): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (level: "error" | "warning", message: string): void => {
    issues.push({ level, drawId: draw.drawId, date: draw.date, message });
  };

  if (!draw.drawId?.trim()) issue("error", "Missing drawId");
  if (!draw.sourceArchive?.trim()) issue("error", "Missing sourceArchive");
  if (!draw.sourceEntry?.trim()) issue("error", "Missing sourceEntry");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draw.date)) {
    issue("error", `Invalid date format: ${draw.date}`);
  } else {
    const parsed = new Date(`${draw.date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== draw.date) {
      issue("error", `Invalid calendar date: ${draw.date}`);
    }
  }

  if (draw.drawSequence !== null && (!Number.isInteger(draw.drawSequence) || draw.drawSequence < 0)) {
    issue("error", `Invalid drawSequence: ${draw.drawSequence}`);
  }

  const expectedCount = draw.ruleSet === "historic-6-plus-complementary" ? 6 : 5;
  if (draw.numbers.length !== expectedCount) {
    issue("error", `Expected ${expectedCount} main numbers, found ${draw.numbers.length}`);
  }

  if (!allUnique(draw.numbers)) issue("error", "Duplicate main number inside the draw");
  for (const n of draw.numbers) {
    if (!inRange(n, 1, 49)) issue("error", `Main number out of range: ${n}`);
  }

  if (!sameNumbers(draw.sortedNumbers, expectedSorted(draw.numbers))) {
    issue("error", "sortedNumbers does not match sorted main numbers");
  }

  if (draw.ruleSet === "historic-6-plus-complementary") {
    if (draw.date > "2008-10-04") issue("error", "Historic regime used after 2008-10-04");

    if (draw.complementaryNumber === null || !inRange(draw.complementaryNumber, 1, 49)) {
      issue("error", `Invalid complementary number: ${draw.complementaryNumber}`);
    } else if (draw.numbers.includes(draw.complementaryNumber)) {
      issue("error", `Complementary number duplicates a main number: ${draw.complementaryNumber}`);
    }

    if (draw.chanceNumber !== null) issue("error", "Historic draw unexpectedly has a Chance number");
  } else {
    if (draw.date < "2008-10-06") issue("error", "Modern regime used before 2008-10-06");

    if (draw.chanceNumber === null || !inRange(draw.chanceNumber, 1, 10)) {
      issue("error", `Invalid Chance number: ${draw.chanceNumber}`);
    }

    if (draw.complementaryNumber !== null) issue("error", "Modern draw unexpectedly has a complementary number");
  }

  if (draw.secondDraw) {
    if (draw.secondDraw.numbers.length !== 5) issue("error", "Second draw does not contain exactly 5 numbers");
    if (!allUnique(draw.secondDraw.numbers)) issue("error", "Duplicate number inside second draw");

    for (const n of draw.secondDraw.numbers) {
      if (!inRange(n, 1, 49)) issue("error", `Second-draw number out of range: ${n}`);
    }

    if (!sameNumbers(draw.secondDraw.sortedNumbers, expectedSorted(draw.secondDraw.numbers))) {
      issue("error", "Second-draw sortedNumbers is inconsistent");
    }

    validatePrizeTiers(draw.secondDraw.prizeTiers, issue, "second draw prize tiers");
  }

  validatePrizeTiers(draw.prizeTiers, issue, "prize tiers");

  if (draw.currency !== null && !["eur", "frf"].includes(draw.currency)) {
    issue("warning", `Unexpected currency: ${draw.currency}`);
  }

  if (draw.day) {
    const actual = weekdayForDate(draw.date);
    const declared = normalizedWeekday(draw.day);
    if (declared !== actual) issue("error", `Weekday mismatch: source=${draw.day}, calendar=${actual}`);
  }

  return issues;
}

function orderKey(draw: LotoDraw): string {
  const sequence = String(draw.drawSequence ?? 0).padStart(5, "0");
  return `${draw.date}|${sequence}|${draw.drawId}`;
}

export function validateDataset(draws: LotoDraw[], previousDraws: LotoDraw[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenCanonical = new Set<string>();
  const seenDateSequence = new Set<string>();
  const seenNumberSequence = new Set<string>();
  let previousKey: string | null = null;

  for (const draw of draws) {
    issues.push(...validateDraw(draw));

    const canonical = `${draw.date}|${draw.drawId}`;
    if (seenCanonical.has(canonical)) {
      issues.push({ level: "error", drawId: draw.drawId, date: draw.date, message: "Duplicate canonical draw key" });
    }
    seenCanonical.add(canonical);

    const dateSequence = `${draw.date}|${draw.drawSequence ?? 0}`;
    if (seenDateSequence.has(dateSequence)) {
      issues.push({ level: "error", drawId: draw.drawId, date: draw.date, message: "Duplicate date + drawSequence key" });
    }
    seenDateSequence.add(dateSequence);

    if (draw.drawNumber) {
      const numberSequence = `${draw.date}|${draw.drawNumber}|${draw.drawSequence ?? 0}`;
      if (seenNumberSequence.has(numberSequence)) {
        issues.push({ level: "error", drawId: draw.drawId, date: draw.date, message: "Duplicate date + drawNumber + drawSequence key" });
      }
      seenNumberSequence.add(numberSequence);
    }

    const currentKey = orderKey(draw);
    if (previousKey !== null && currentKey < previousKey) {
      issues.push({ level: "error", drawId: draw.drawId, date: draw.date, message: "Dataset is not chronologically sorted" });
    }
    previousKey = currentKey;
  }

  for (const previous of previousDraws) {
    if (!seenCanonical.has(`${previous.date}|${previous.drawId}`)) {
      issues.push({ level: "error", drawId: previous.drawId, date: previous.date, message: "Missing previous draw" });
    }
  }

  // Conservative gap limits, not a claim that the source calendar is exhaustive.
  // Early archives contain holidays and a 15-day gap at the start of the history.
  for (let index = 1; index < draws.length; index += 1) {
    const previous = draws[index - 1];
    const current = draws[index];
    const days = (Date.parse(current.date) - Date.parse(previous.date)) / 86_400_000;
    const limit = current.ruleSet === "modern-5-plus-chance" ? 7 : 31;
    if (days > limit) {
      issues.push({ level: "error", date: current.date, message: `Unexpected draw gap: ${previous.date} -> ${current.date} (${days} days)` });
    }
  }

  const firstDate = draws.at(0)?.date ?? null;
  if (!firstDate || firstDate > "1976-05-31") {
    issues.push({ level: "error", message: `History does not reach May 1976 (first=${firstDate ?? "none"})` });
  }

  const historic = draws.filter((draw) => draw.ruleSet === "historic-6-plus-complementary");
  const modern = draws.filter((draw) => draw.ruleSet === "modern-5-plus-chance");

  if (!historic.length || !modern.length) {
    issues.push({ level: "error", message: `Both rule sets must exist (historic=${historic.length}, modern=${modern.length})` });
  }

  if (historic.length && historic.at(-1)?.date !== "2008-10-04") {
    issues.push({ level: "error", message: `Unexpected last historic draw: ${historic.at(-1)?.date ?? "none"}` });
  }

  if (modern.length && modern.at(0)?.date !== "2008-10-06") {
    issues.push({ level: "error", message: `Unexpected first modern draw: ${modern.at(0)?.date ?? "none"}` });
  }

  return issues;
}

function parisDateParts(now: Date): { date: string; hour: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const utcNoon = new Date(`${date}T12:00:00Z`);
  return { date, hour: Number(parts.hour), weekday: utcNoon.getUTCDay() };
}

export function expectedLatestCompletedDrawDate(now = new Date()): string {
  const paris = parisDateParts(now);
  let cursor = new Date(`${paris.date}T12:00:00Z`);

  if ([1, 3, 6].includes(paris.weekday) && paris.hour < 22) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  for (let i = 0; i < 8; i += 1) {
    if ([1, 3, 6].includes(cursor.getUTCDay())) return cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  throw new Error("Unable to resolve expected latest draw date");
}

export function buildValidationReport(draws: LotoDraw[], previousDraws: LotoDraw[] = [], now = new Date()) {
  const issues = validateDataset(draws, previousDraws);
  const first = draws.at(0)?.date ?? null;
  const last = draws.at(-1)?.date ?? null;
  const expected = expectedLatestCompletedDrawDate(now);
  if (last && last !== expected) {
    issues.push({ level: "warning", message: `Latest draw differs from expected calendar draw (actual=${last}, expected=${expected})` });
  }
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    draws: draws.length,
    historic: draws.filter(draw => draw.ruleSet === "historic-6-plus-complementary").length,
    modern: draws.filter(draw => draw.ruleSet === "modern-5-plus-chance").length,
    dateRange: { first, last },
    expectedLatestDraw: expected,
    errors: issues.filter(issue => issue.level === "error").length,
    warnings: issues.filter(issue => issue.level === "warning").length,
    issues
  };
}
