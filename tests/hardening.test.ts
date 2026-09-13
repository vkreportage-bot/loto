import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { dedupeDrawsStrict } from "../src/dedupe.js";
import { extractSafeZipEntries, inspectZip, sha256 } from "../src/archive-security.js";
import { validateDataset, validateDraw } from "../src/validation.js";
import type { LotoDraw } from "../src/types.js";

function modernDraw(overrides: Partial<LotoDraw> = {}): LotoDraw {
  return {
    drawId: "20260907",
    drawNumber: "20260907",
    drawSequence: null,
    date: "2026-09-07",
    day: "lundi",
    ruleSet: "modern-5-plus-chance",
    numbers: [2, 13, 18, 21, 36],
    sortedNumbers: [2, 13, 18, 21, 36],
    complementaryNumber: null,
    chanceNumber: 3,
    secondDraw: null,
    prizeTiers: [],
    winningCodes: [],
    currency: "eur",
    sourceArchive: "2019-present",
    sourceEntry: "loto.csv",
    ...overrides
  };
}

test("strict dedupe accepts identical boundary duplicate", () => {
  const a = modernDraw();
  const b = modernDraw({ sourceArchive: "other", sourceEntry: "copy.csv" });
  const result = dedupeDrawsStrict([a, b]);
  assert.equal(result.draws.length, 1);
  assert.equal(result.duplicates.length, 1);
});

test("strict dedupe rejects conflicting duplicate", () => {
  const a = modernDraw();
  const b = modernDraw({
    numbers: [1, 13, 18, 21, 36],
    sortedNumbers: [1, 13, 18, 21, 36],
    sourceArchive: "other"
  });
  assert.throws(() => dedupeDrawsStrict([a, b]), /Conflicting duplicate draw/);
});

test("validation catches bad sorted numbers and Chance range", () => {
  const issues = validateDraw(modernDraw({
    sortedNumbers: [36, 21, 18, 13, 2],
    chanceNumber: 11
  }));
  assert.ok(issues.some((issue) => issue.message.includes("sortedNumbers")));
  assert.ok(issues.some((issue) => issue.message.includes("Chance")));
});

test("validation rejects modern regime before transition", () => {
  const issues = validateDraw(modernDraw({ date: "2008-10-04", day: "samedi" }));
  assert.ok(issues.some((issue) => issue.message.includes("Modern regime used before")));
});

test("validation rejects negative prize winners", () => {
  const issues = validateDraw(modernDraw({
    prizeTiers: [{ rank: 1, winners: -1, payout: 1000 }]
  }));
  assert.ok(issues.some((issue) => issue.message.includes("invalid winners")));
});

test("ZIP inspection accepts a small CSV archive", () => {
  const zip = Buffer.from(zipSync({ "folder/loto.csv": strToU8("date;boule_1\n20260907;2\n") }));
  const inspection = inspectZip(zip);
  assert.equal(inspection.entries.length, 1);
  assert.equal(extractSafeZipEntries(zip)[0]?.name, "folder/loto.csv");
  assert.equal(sha256(zip).length, 64);
});

test("ZIP inspection rejects path traversal entries", () => {
  const zip = Buffer.from(zipSync({ "../evil.csv": strToU8("x") }));
  assert.throws(() => inspectZip(zip), /Unsafe ZIP entry path/);
});

test("dataset validation catches duplicate keys", () => {
  const issues = validateDataset([modernDraw(), modernDraw()]);
  assert.ok(issues.some((issue) => issue.message.includes("Duplicate canonical draw key")));
});

test("ZIP inspection rejects inconsistent directory entry counts before extraction", () => {
  const zip = Buffer.from(zipSync({ "a.csv": strToU8("x") }));
  zip.writeUInt16LE(0, zip.length - 22 + 10);
  assert.throws(() => inspectZip(zip), /Unsupported ZIP directory/);
});
