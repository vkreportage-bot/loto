import { pairFrequencies } from "./combinations.js";
import { frequencyTable, numberFrequencies } from "./frequencies.js";
import type { LotoDraw, LotoRuleSet, StatisticsSummary } from "./types.js";

export function buildStatistics(draws: LotoDraw[], now = new Date()): StatisticsSummary {
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
    generatedAt: now.toISOString(),
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

  return summary;
}
