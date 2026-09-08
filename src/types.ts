export type LotoRuleSet = "historic-6-plus-complementary" | "modern-5-plus-chance";

export interface PrizeTier {
  rank: number;
  winners: number | null;
  payoutEur: number | null;
}

export interface SecondDraw {
  numbers: number[];
  sortedNumbers: number[];
  prizeTiers: PrizeTier[];
}

export interface LotoDraw {
  drawId: string;
  drawNumber: string | null;
  drawSequence: number | null;
  date: string;
  day: string | null;
  ruleSet: LotoRuleSet;
  numbers: number[];
  sortedNumbers: number[];
  complementaryNumber: number | null;
  chanceNumber: number | null;
  secondDraw: SecondDraw | null;
  prizeTiers: PrizeTier[];
  winningCodes: string[];
  currency: string | null;
  sourceArchive: string;
  sourceEntry: string;
}

export interface FrequencyRow {
  number: number;
  count: number;
  draws: number;
  ratePerDraw: number;
  lastSeenDate: string | null;
  delayInDraws: number | null;
}

export interface PairFrequencyRow {
  pair: [number, number];
  count: number;
  draws: number;
  ratePerDraw: number;
}

export interface StatisticsSummary {
  generatedAt: string;
  totalDraws: number;
  dateRange: { first: string | null; last: string | null };
  byRuleSet: Record<
    LotoRuleSet,
    {
      draws: number;
      mainNumberFrequencies: FrequencyRow[];
      topPairs: PairFrequencyRow[];
    }
  >;
  historicComplementaryFrequencies: FrequencyRow[];
  modernChanceFrequencies: FrequencyRow[];
}
