import { pairFrequencies } from "./combinations.js";
import { frequencyTable, numberFrequencies } from "./frequencies.js";
import { readDraws, writeJson } from "./io.js";
import type { LotoRuleSet, StatisticsSummary } from "./types.js";

const MASTER_PATH = "data/processed/loto-master.json";
const OUTPUT_PATH = "data/processed/stats-summary.json";

async function main() {
  const draws = await readDraws(MASTER_PATH);
  const ruleSets: LotoRuleSet[] = ["historic-6-plus-complementary", "modern-5-plus-chance"];

  const byRuleSet = Object.fromEntries(
    ruleSets.map((ruleSet) => {
      const subset = draws.filter((draw) => draw.ruleSet === ruleSet);
      return [
        ruleSet,
        {
          draws: subset.length,
          mainNumberFrequencies: numberFrequencies(subset),
          topPairs: pairFrequencies(subset).slice(0, 100)
        }
      ];
    })
  ) as StatisticsSummary["byRuleSet"];

  const historic = draws.filter((draw) => draw.ruleSet === "historic-6-plus-complementary");
  const modern = draws.filter((draw) => draw.ruleSet === "modern-5-plus-chance");

  const summary: StatisticsSummary = {
    generatedAt: new Date().toISOString(),
    totalDraws: draws.length,
    dateRange: {
      first: draws.at(0)?.date ?? null,
      last: draws.at(-1)?.date ?? null
    },
    byRuleSet,
    historicComplementaryFrequencies: frequencyTable(historic, (draw) =>
      draw.complementaryNumber === null ? [] : [draw.complementaryNumber]
    ),
    modernChanceFrequencies: frequencyTable(modern, (draw) =>
      draw.chanceNumber === null ? [] : [draw.chanceNumber]
    )
  };

  await writeJson(OUTPUT_PATH, summary);

  console.log(`Statistics written to ${OUTPUT_PATH}`);
  console.log(`Draws: ${summary.totalDraws}`);
  console.log(`Range: ${summary.dateRange.first ?? "?"} -> ${summary.dateRange.last ?? "?"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
