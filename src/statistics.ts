import { readFile } from "node:fs/promises";
import { numberFrequencies } from "./frequencies.js";
import type { LotoDraw } from "./types.js";

async function main() {
  const path = new URL("../data/processed/loto-master.json", import.meta.url);

  const raw = await readFile(path, "utf8");
  const draws = JSON.parse(raw) as LotoDraw[];

  console.table(numberFrequencies(draws).slice(0, 20));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
