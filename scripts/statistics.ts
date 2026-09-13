import { readDraws, writeJson } from "../src/io.js";
import { buildStatistics } from "../src/statistics.js";
import { validateDataset } from "../src/validation.js";

async function main() {
  const draws = await readDraws("data/processed/loto-master.json");
  const errors = validateDataset(draws).filter(issue => issue.level === "error");
  if (errors.length) throw new Error(`Cannot compute statistics: ${errors[0].message}`);
  await writeJson("data/processed/stats-summary.json", buildStatistics(draws));
  console.log(`Statistics written for ${draws.length} draws.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
