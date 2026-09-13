import { readDraws, writeJson } from "../src/io.js";
import { buildValidationReport } from "../src/validation.js";

async function main() {
  const draws = await readDraws("data/processed/loto-master.json");
  const report = buildValidationReport(draws);
  await writeJson("data/processed/validation-report.json", report);
  for (const issue of report.issues.slice(0, 100)) {
    console.error(`${issue.level.toUpperCase()}: ${issue.date ?? ""} ${issue.message}`);
  }
  if (report.errors) throw new Error(`Validation failed with ${report.errors} error(s).`);
  console.log(`Validation OK: ${draws.length} draws, ${report.warnings} warning(s).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
