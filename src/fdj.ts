import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import type { LotoDraw, LotoRuleSet, PrizeTier, SecondDraw } from "./types.js";

export const FDJ_HISTORY_PAGE = "https://www.fdj.fr/jeux-de-tirage/loto/historique";

export interface ArchiveDefinition {
  id: string;
  label: string;
  url: string;
  order: number;
}

// URLs officielles FDJ. La première archive est mise à jour au fil des tirages.
export const FALLBACK_ARCHIVES: ArchiveDefinition[] = [
  {
    id: "2019-present",
    label: "Novembre 2019 à aujourd'hui",
    url: "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66afp6",
    order: 5
  },
  {
    id: "2019-02-to-2019-11",
    label: "Février 2019 à novembre 2019",
    url: "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66afo6",
    order: 4
  },
  {
    id: "2017-03-to-2019-02",
    label: "Mars 2017 à février 2019",
    url: "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66afn6",
    order: 3
  },
  {
    id: "2008-10-to-2017-03",
    label: "Octobre 2008 à mars 2017",
    url: "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66afm6",
    order: 2
  },
  {
    id: "1976-05-to-2008-10",
    label: "Mai 1976 à octobre 2008",
    url: "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66afl6",
    order: 1
  }
];

export async function discoverOfficialArchiveUrls(): Promise<string[]> {
  try {
    const response = await fetch(FDJ_HISTORY_PAGE, {
      headers: {
        "user-agent": "loto-data/0.2 (+https://github.com/vkreportage-bot/loto)",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) return [];

    const html = (await response.text()).replaceAll("\\u002F", "/").replaceAll("\\/", "/");
    const matches = html.match(/https:\/\/www\.sto\.api\.fdj\.fr\/anonymous\/service-draw-info\/v3\/documentations\/[A-Za-z0-9-]+/g) ?? [];
    return [...new Set(matches)];
  } catch {
    return [];
  }
}

export async function resolveArchives(): Promise<ArchiveDefinition[]> {
  const discovered = await discoverOfficialArchiveUrls();
  if (discovered.length < 5) return FALLBACK_ARCHIVES;

  // Les identifiants officiels sont stables ; si la page en fournit au moins 5,
  // on remplace seulement les URL correspondantes à partir du suffixe connu.
  const bySuffix = new Map(discovered.map((url) => [url.slice(-3), url]));
  return FALLBACK_ARCHIVES.map((archive) => ({
    ...archive,
    url: bySuffix.get(archive.url.slice(-3)) ?? archive.url
  }));
}

export async function downloadArchive(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "loto-data/0.2 (+https://github.com/vkreportage-bot/loto)",
      accept: "application/zip,application/octet-stream,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`FDJ download failed (${response.status}) for ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export interface CsvEntry {
  name: string;
  text: string;
}

function decodeCsv(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("�")) return utf8.replace(/^\uFEFF/, "");
  return iconv.decode(buffer, "win1252").replace(/^\uFEFF/, "");
}

export function extractCsvEntries(zipBuffer: Buffer): CsvEntry[] {
  const zip = new AdmZip(zipBuffer);
  return zip
    .getEntries()
    .filter((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".csv"))
    .map((entry) => ({ name: entry.entryName, text: decodeCsv(entry.getData()) }));
}

export type RawRow = Record<string, string>;

export function parseFdjCsv(text: string): RawRow[] {
  return parse(text, {
    columns: (header: string[]) => header.map((value) => value.trim().replace(/^\uFEFF/, "")),
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true
  }) as RawRow[];
}

function nullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function nullableInt(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number.parseInt(text.replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function nullableFrenchFloat(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function normalizeDate(value: unknown): string {
  const text = String(value ?? "").trim();

  function canonical(year: number, month: number, day: number): string {
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`Invalid draw date: ${text || "<empty>"}`);
    }

    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Formats FDJ rencontrés/tolérés :
  // DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD,
  // YYYYMMDD (anciennes archives), DDMMYYYY.
  let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return canonical(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    return canonical(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  if (/^\d{8}$/.test(text)) {
    const firstFour = Number(text.slice(0, 4));

    // YYYYMMDD si les 4 premiers chiffres représentent une année plausible.
    if (firstFour >= 1900 && firstFour <= 2100) {
      return canonical(
        firstFour,
        Number(text.slice(4, 6)),
        Number(text.slice(6, 8))
      );
    }

    // Sinon DDMMYYYY.
    return canonical(
      Number(text.slice(4, 8)),
      Number(text.slice(2, 4)),
      Number(text.slice(0, 2))
    );
  }

  throw new Error(`Unsupported draw date: ${text || "<empty>"}`);
}

function buildPrizeTiers(row: RawRow, suffix = ""): PrizeTier[] {
  const tiers: PrizeTier[] = [];
  for (let rank = 1; rank <= 9; rank += 1) {
    const winnerKeys = suffix
      ? [`nombre_de_gagnant_au_rang_${rank}_${suffix}`, `nombre_de_gagnant_au_rang${rank}_${suffix}`]
      : [`nombre_de_gagnant_au_rang${rank}`, `nombre_de_gagnant_au_rang_${rank}`];
    const payoutKeys = suffix
      ? [`rapport_du_rang${rank}_${suffix}`, `rapport_du_rang_${rank}_${suffix}`]
      : [`rapport_du_rang${rank}`, `rapport_du_rang_${rank}`];

    const winnerValue = winnerKeys.map((key) => row[key]).find((value) => value !== undefined);
    const payoutValue = payoutKeys.map((key) => row[key]).find((value) => value !== undefined);
    if (winnerValue === undefined && payoutValue === undefined) continue;

    tiers.push({
      rank,
      winners: nullableInt(winnerValue),
      payoutEur: nullableFrenchFloat(payoutValue)
    });
  }
  return tiers;
}

function numbersFrom(row: RawRow, keys: string[]): number[] {
  return keys
    .map((key) => nullableInt(row[key]))
    .filter((value): value is number => value !== null);
}

function parseWinningCodes(row: RawRow): string[] {
  const value = nullableString(row.codes_gagnants);
  if (!value) return [];
  return value.split(",").map((code) => code.trim()).filter(Boolean);
}

function detectRuleSet(row: RawRow): LotoRuleSet {
  return row.boule_6 !== undefined || row.boule_complementaire !== undefined
    ? "historic-6-plus-complementary"
    : "modern-5-plus-chance";
}

function makeDrawId(row: RawRow, date: string, sequence: number | null): string {
  const rawNumber = nullableString(row.annee_numero_de_tirage) ?? nullableString(row.numero_de_tirage);
  const base = rawNumber ?? date.replaceAll("-", "");
  return sequence ? `${base}-${sequence}` : base;
}

export function normalizeFdjRow(row: RawRow, sourceArchive: string, sourceEntry: string): LotoDraw {
  const date = normalizeDate(row.date_de_tirage ?? row.date);
  const ruleSet = detectRuleSet(row);
  const drawSequence = nullableInt(row["1er_ou_2eme_tirage"]);
  const drawNumber = nullableString(row.annee_numero_de_tirage) ?? nullableString(row.numero_de_tirage);

  const numbers = ruleSet === "historic-6-plus-complementary"
    ? numbersFrom(row, ["boule_1", "boule_2", "boule_3", "boule_4", "boule_5", "boule_6"])
    : numbersFrom(row, ["boule_1", "boule_2", "boule_3", "boule_4", "boule_5"]);

  const secondNumbers = numbersFrom(row, [
    "boule_1_second_tirage",
    "boule_2_second_tirage",
    "boule_3_second_tirage",
    "boule_4_second_tirage",
    "boule_5_second_tirage"
  ]);

  const secondDraw: SecondDraw | null = secondNumbers.length
    ? {
        numbers: secondNumbers,
        sortedNumbers: [...secondNumbers].sort((a, b) => a - b),
        prizeTiers: buildPrizeTiers(row, "second_tirage")
      }
    : null;

  return {
    drawId: makeDrawId(row, date, drawSequence),
    drawNumber,
    drawSequence,
    date,
    day: nullableString(row.jour_de_tirage)?.trim() ?? null,
    ruleSet,
    numbers,
    sortedNumbers: [...numbers].sort((a, b) => a - b),
    complementaryNumber: ruleSet === "historic-6-plus-complementary" ? nullableInt(row.boule_complementaire) : null,
    chanceNumber: ruleSet === "modern-5-plus-chance" ? nullableInt(row.numero_chance) : null,
    secondDraw,
    prizeTiers: buildPrizeTiers(row),
    winningCodes: parseWinningCodes(row),
    currency: nullableString(row.devise)?.toLowerCase() ?? null,
    sourceArchive,
    sourceEntry
  };
}

export function sortDraws(draws: LotoDraw[]): LotoDraw[] {
  return [...draws].sort((a, b) => {
    const date = a.date.localeCompare(b.date);
    if (date !== 0) return date;
    return (a.drawSequence ?? 0) - (b.drawSequence ?? 0) || a.drawId.localeCompare(b.drawId);
  });
}
