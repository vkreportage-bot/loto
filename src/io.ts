import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { LotoDraw } from "./types.js";

export async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readDraws(path: string): Promise<LotoDraw[]> {
  return JSON.parse(await readFile(path, "utf8")) as LotoDraw[];
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[;"\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function drawsToCsv(draws: LotoDraw[]): string {
  const headers = [
    "draw_id",
    "draw_number",
    "draw_sequence",
    "date",
    "day",
    "rule_set",
    "n1",
    "n2",
    "n3",
    "n4",
    "n5",
    "n6",
    "complementary",
    "chance",
    "second_n1",
    "second_n2",
    "second_n3",
    "second_n4",
    "second_n5",
    "source_archive",
    "source_entry"
  ];

  const lines = [headers.join(";")];
  for (const draw of draws) {
    const main = [...draw.numbers, null, null, null, null, null, null].slice(0, 6);
    const second = [...(draw.secondDraw?.numbers ?? []), null, null, null, null, null].slice(0, 5);
    lines.push(
      [
        draw.drawId,
        draw.drawNumber,
        draw.drawSequence,
        draw.date,
        draw.day,
        draw.ruleSet,
        ...main,
        draw.complementaryNumber,
        draw.chanceNumber,
        ...second,
        draw.sourceArchive,
        draw.sourceEntry
      ].map(csvCell).join(";")
    );
  }

  return `${lines.join("\n")}\n`;
}
