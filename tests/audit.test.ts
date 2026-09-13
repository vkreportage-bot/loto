import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { FALLBACK_ARCHIVES, extractCsvEntries, normalizeFdjRow, parseFdjCsv, sortDraws } from "../src/fdj.js";
import { dedupeDrawsStrict } from "../src/dedupe.js";
import { validateDataset } from "../src/validation.js";

const archives = await Promise.all(FALLBACK_ARCHIVES.map(async (archive) => {
  const entries = extractCsvEntries(await readFile(new URL(`../data/raw/archives/${archive.id}.zip`, import.meta.url)));
  return entries.flatMap(entry => parseFdjCsv(entry.text).map(row => ({ row, archive: archive.id, entry: entry.name })));
}));
const sources = archives.flat();
const draws = sortDraws(dedupeDrawsStrict(sources.map(({ row, archive, entry }) => normalizeFdjRow(row, archive, entry))).draws);

test("all local FDJ archives pass canonical validation, including reused historic numbers", () => {
  const issues = validateDataset(draws);
  assert.deepEqual(issues, []);
});

test("a missing full year is detected without a previous dataset", () => {
  const issues = validateDataset(draws.filter(draw => !draw.date.startsWith("2020-")));
  assert.ok(issues.some(issue => issue.message.includes("gap")));
});

test("a missing historic draw or last draw is detected against the previous dataset", () => {
  for (const index of [10, draws.length - 1]) {
    const issues = validateDataset(draws.filter((_, i) => i !== index), draws);
    assert.ok(issues.some(issue => issue.message.includes("Missing previous draw")));
  }
});

const modern = sources.find(source => source.archive === "2019-present")!;
for (const [field, value] of [["boule_1", "2garbage"], ["boule_1", "2.9"], ["rapport_du_rang1", "123garbage"], ["nombre_de_gagnant_au_rang1", "oops"]]) {
  test(`malformed ${field}=${value} is rejected`, () => {
    assert.throws(() => normalizeFdjRow({ ...modern.row, [field]: value }, modern.archive, modern.entry), /Invalid numeric/);
  });
}

test("French decimal, grouped and scientific payouts remain supported in the source currency", () => {
  for (const [value, expected] of [["1 234,50", 1234.5], ["5,8E+6", 5800000]] as const) {
    const draw = normalizeFdjRow({ ...modern.row, rapport_du_rang1: value, devise: "frf" }, modern.archive, modern.entry);
    assert.equal(draw.prizeTiers[0].payout, expected);
    assert.equal(draw.currency, "frf");
    assert.ok(!("payoutEur" in draw.prizeTiers[0]));
  }
});
