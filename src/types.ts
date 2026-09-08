export type LotoRuleSet = "1976-2008" | "2008-present";

export interface LotoDraw {
  date: string;
  ruleSet: LotoRuleSet;
  numbers: number[];
  extraNumber?: number | null;
  chanceNumber?: number | null;
  source?: string;
}
