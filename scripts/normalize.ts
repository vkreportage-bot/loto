import { cp, readFile, stat, writeFile } from "node:fs/promises";
import {
  extractCsvEntries,
  FALLBACK_ARCHIVES,
  normalizeFdjRow,
  parseFdjCsv,
  sortDraws
} from "../src/fdj.js";
import { drawsToCsv, readDraws, writeJson } from "../src/io.js";
import { dedupeDrawsStrict } from "../src/dedupe.js";
import { publishDirectory } from "../src/publication.js";
import { buildValidationReport } from "../src/validation.js";
import { buildStatistics } from "../src/statistics.js";
import type { LotoDraw } from "../src/types.js";

const RAW_DIR = "data/raw/archives";
const MASTER_JSON = "data/processed/loto-master.json";


async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}


async function normalize(staging: string) {
  const missing = [];
  for (const archive of FALLBACK_ARCHIVES) {
    const path = `${RAW_DIR}/${archive.id}.zip`;
    if (!(await exists(path))) missing.push(path);
  }

  if (missing.length) {
    throw new Error(`Missing raw archive(s). Run npm run import first:\n${missing.join("\n")}`);
  }

  const parsedDraws: LotoDraw[] = [];
  let rawRows = 0;

  // Keep the oldest provenance when boundary duplicates are canonically identical.
  for (const archive of [...FALLBACK_ARCHIVES].sort((a, b) => a.order - b.order)) {
    const path = `${RAW_DIR}/${archive.id}.zip`;
    const zipBuffer = await readFile(path);
    const entries = extractCsvEntries(zipBuffer);

    if (!entries.length) {
      throw new Error(`No CSV found in ${path}`);
    }

    for (const entry of entries) {
      const rows = parseFdjCsv(entry.text);
      rawRows += rows.length;

      rows.forEach((row, index) => {
        try {
          const draw = normalizeFdjRow(row, archive.id, entry.name);
          parsedDraws.push(draw);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${archive.id}/${entry.name} row ${index + 2}: ${message}`);
        }
      });
    }
  }

  const dedupe = dedupeDrawsStrict(parsedDraws);
  const draws = sortDraws(dedupe.draws);
  const historic = draws.filter((draw) => draw.ruleSet === "historic-6-plus-complementary");
  const modern = draws.filter((draw) => draw.ruleSet === "modern-5-plus-chance");

  let previous: LotoDraw[] = [];
  try {
    previous = await readDraws(MASTER_JSON);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const now = new Date();
  const validation = buildValidationReport(draws, previous, now);
  if (validation.errors) {
    throw new Error(`Validation failed before publication: ${validation.issues.filter(issue => issue.level === "error").slice(0, 10).map(issue => `${issue.date ?? ""} ${issue.message}`).join("; ")}`);
  }
  const statistics = buildStatistics(draws, now);
  // Preserve ancillary files (for example .gitkeep) alongside generated outputs.
  if (await exists("data/processed")) await cp("data/processed", staging, { recursive: true });
  await writeJson(`${staging}/loto-master.json`, draws);
  await writeFile(`${staging}/loto-master.csv`, drawsToCsv(draws), "utf8");
  await writeFile(`${staging}/loto-historic.csv`, drawsToCsv(historic), "utf8");
  await writeFile(`${staging}/loto-modern.csv`, drawsToCsv(modern), "utf8");
  await writeJson(`${staging}/validation-report.json`, validation);
  await writeJson(`${staging}/stats-summary.json`, statistics);
  await writeJson(`${staging}/normalization-report.json`, {
    generatedAt: now.toISOString(),
    rawRows,
    normalizedDraws: draws.length,
    duplicatesRemoved: dedupe.duplicates.length,
    duplicateProvenance: dedupe.duplicates,
    historicDraws: historic.length,
    modernDraws: modern.length,
    dateRange: {
      first: draws.at(0)?.date ?? null,
      last: draws.at(-1)?.date ?? null
    }
  });

  for (const issue of validation.issues) console.warn(`WARNING: ${issue.message}`);
  console.log(`Prepared ${draws.length} draws (${dedupe.duplicates.length} verified boundary duplicates removed).`);
  console.log(`Historic: ${historic.length}; modern: ${modern.length}`);
  console.log(`Range: ${draws.at(0)?.date ?? "?"} -> ${draws.at(-1)?.date ?? "?"}`);
}

publishDirectory("data/processed", normalize).then(() => {
  console.log("Published validated dataset, exports and statistics.");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
