import { readFile, stat, writeFile } from "node:fs/promises";
import {
  extractCsvEntries,
  FALLBACK_ARCHIVES,
  normalizeFdjRow,
  parseFdjCsv,
  sortDraws
} from "../src/fdj.js";
import { drawsToCsv, ensureParent, writeJson } from "../src/io.js";
import type { LotoDraw } from "../src/types.js";

const RAW_DIR = "data/raw/archives";
const MASTER_JSON = "data/processed/loto-master.json";
const MASTER_CSV = "data/processed/loto-master.csv";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function dedupeKey(draw: LotoDraw): string {
  return `${draw.date}|${draw.drawId}`;
}

async function main() {
  const missing = [];
  for (const archive of FALLBACK_ARCHIVES) {
    const path = `${RAW_DIR}/${archive.id}.zip`;
    if (!(await exists(path))) missing.push(path);
  }

  if (missing.length) {
    throw new Error(`Missing raw archive(s). Run npm run import first:\n${missing.join("\n")}`);
  }

  const deduped = new Map<string, LotoDraw>();
  let rawRows = 0;

  // Oldest -> newest, so a newer archive wins on a boundary duplicate.
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
          deduped.set(dedupeKey(draw), draw);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${archive.id}/${entry.name} row ${index + 2}: ${message}`);
        }
      });
    }
  }

  const draws = sortDraws([...deduped.values()]);
  const historic = draws.filter((draw) => draw.ruleSet === "historic-6-plus-complementary");
  const modern = draws.filter((draw) => draw.ruleSet === "modern-5-plus-chance");

  await writeJson(MASTER_JSON, draws);
  await ensureParent(MASTER_CSV);
  await writeFile(MASTER_CSV, drawsToCsv(draws), "utf8");
  await writeFile("data/processed/loto-historic.csv", drawsToCsv(historic), "utf8");
  await writeFile("data/processed/loto-modern.csv", drawsToCsv(modern), "utf8");
  await writeJson("data/processed/normalization-report.json", {
    generatedAt: new Date().toISOString(),
    rawRows,
    normalizedDraws: draws.length,
    duplicatesRemoved: rawRows - draws.length,
    historicDraws: historic.length,
    modernDraws: modern.length,
    dateRange: {
      first: draws.at(0)?.date ?? null,
      last: draws.at(-1)?.date ?? null
    }
  });

  console.log(`Normalized ${draws.length} draws (${rawRows - draws.length} boundary duplicates removed).`);
  console.log(`Historic: ${historic.length}; modern: ${modern.length}`);
  console.log(`Range: ${draws.at(0)?.date ?? "?"} -> ${draws.at(-1)?.date ?? "?"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
