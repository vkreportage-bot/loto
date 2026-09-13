import { readFile, stat } from "node:fs/promises";
import type { Dataset } from "../frontend/model.js";
import type { LotoDraw } from "./types.js";
import { validateDataset } from "./validation.js";

export async function readFrontendData(path = "data/processed/loto-master.json"): Promise<Dataset> {
  const draws = JSON.parse(await readFile(path, "utf8")) as LotoDraw[];
  const errors = validateDataset(draws).filter(issue => issue.level === "error");
  if(errors.length) throw new Error(`Dataset invalid: ${errors[0].message}`);
  return {
    schemaVersion: 1, updatedAt: (await stat(path)).mtime.toISOString(),
    draws: draws.map(draw => ({
      id: draw.drawId, date: draw.date,
      regime: draw.ruleSet === "modern-5-plus-chance" ? "modern" : "historic",
      numbers: draw.numbers, bonus: draw.chanceNumber ?? draw.complementaryNumber!,
      second: draw.secondDraw?.numbers ?? null
    }))
  };
}
