import { readDraws, writeJson } from "../src/io.js";
import type { LotoDraw } from "../src/types.js";

const MASTER_PATH = "data/processed/loto-master.json";

interface ValidationIssue {
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

function validateDraw(draw: LotoDraw): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (level: "error" | "warning", message: string): void => {
    issues.push({ level, drawId: draw.drawId, date: draw.date, message });
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draw.date) || Number.isNaN(Date.parse(`${draw.date}T00:00:00Z`))) {
    issue("error", `Invalid date: ${draw.date}`);
  }

  const expectedCount = draw.ruleSet === "historic-6-plus-complementary" ? 6 : 5;
  if (draw.numbers.length !== expectedCount) {
    issue("error", `Expected ${expectedCount} main numbers, found ${draw.numbers.length}`);
  }

  if (!allUnique(draw.numbers)) issue("error", "Duplicate main number inside the draw");
  for (const n of draw.numbers) {
    if (!inRange(n, 1, 49)) issue("error", `Main number out of range: ${n}`);
  }

  if (draw.ruleSet === "historic-6-plus-complementary") {
    if (draw.complementaryNumber === null || !inRange(draw.complementaryNumber, 1, 49)) {
      issue("error", `Invalid complementary number: ${draw.complementaryNumber}`);
    } else if (draw.numbers.includes(draw.complementaryNumber)) {
      issue("error", `Complementary number duplicates a main number: ${draw.complementaryNumber}`);
    }
    if (draw.chanceNumber !== null) issue("error", "Historic draw unexpectedly has a Chance number");
  } else {
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
  }

  return issues;
}

async function main() {
  const draws = await readDraws(MASTER_PATH);
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const draw of draws) {
    const key = `${draw.date}|${draw.drawId}`;
    if (seen.has(key)) {
      issues.push({ level: "error", drawId: draw.drawId, date: draw.date, message: "Duplicate canonical draw key" });
    }
    seen.add(key);
    issues.push(...validateDraw(draw));
  }

  const firstDate = draws.at(0)?.date ?? null;
  const lastDate = draws.at(-1)?.date ?? null;

  if (!firstDate || firstDate > "1976-05-31") {
    issues.push({ level: "error", message: `History does not reach May 1976 (first=${firstDate ?? "none"})` });
  }

  if (lastDate) {
    const ageDays = Math.floor((Date.now() - Date.parse(`${lastDate}T00:00:00Z`)) / 86_400_000);
    if (ageDays > 14) {
      issues.push({ level: "warning", message: `Latest draw is ${ageDays} days old (${lastDate})` });
    }
    if (ageDays < -1) {
      issues.push({ level: "error", message: `Latest draw is in the future (${lastDate})` });
    }
  }

  const historic = draws.filter((draw) => draw.ruleSet === "historic-6-plus-complementary").length;
  const modern = draws.filter((draw) => draw.ruleSet === "modern-5-plus-chance").length;

  if (!historic || !modern) {
    issues.push({ level: "error", message: `Both rule sets must exist (historic=${historic}, modern=${modern})` });
  }

  const errors = issues.filter((entry) => entry.level === "error");
  const warnings = issues.filter((entry) => entry.level === "warning");

  const report = {
    generatedAt: new Date().toISOString(),
    draws: draws.length,
    historic,
    modern,
    dateRange: { first: firstDate, last: lastDate },
    errors: errors.length,
    warnings: warnings.length,
    issues
  };

  await writeJson("data/processed/validation-report.json", report);

  for (const warning of warnings) console.warn(`WARNING: ${warning.message}`);
  for (const error of errors.slice(0, 50)) console.error(`ERROR: ${error.date ?? ""} ${error.drawId ?? ""} ${error.message}`.trim());

  if (errors.length) {
    throw new Error(`Validation failed with ${errors.length} error(s). See data/processed/validation-report.json`);
  }

  console.log(`Validation OK: ${draws.length} draws, ${warnings.length} warning(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
