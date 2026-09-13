import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
import { FALLBACK_ARCHIVES, extractCsvEntries, normalizeFdjRow, parseFdjCsv } from "../src/fdj.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const loader = fileURLToPath(new URL("../node_modules/tsx/dist/loader.mjs", import.meta.url));
const script = fileURLToPath(new URL("../scripts/normalize.ts", import.meta.url));
async function workspace(t: { after(fn: () => Promise<void>): void }) {
  const dir = await mkdtemp(join(tmpdir(), "loto-pipeline-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(join(root, "data"), join(dir, "data"), { recursive: true });
  return dir;
}
function normalize(cwd: string) {
  return spawnSync(process.execPath, ["--import", loader, script], { cwd, encoding: "utf8", timeout: 30000 });
}
async function snapshot(dir: string) {
  const names = (await readdir(join(dir, "data/processed"))).sort();
  return Promise.all(names.map(async name => [name, await readFile(join(dir, "data/processed", name), "utf8")]));
}

test("invalid source numbers never replace published files", async t => {
  const dir = await workspace(t);
  const before = await snapshot(dir);
  const path = join(dir, "data/raw/archives/2019-present.zip");
  const entries = extractCsvEntries(await readFile(path));
  const lines = entries[0].text.split(/\r?\n/);
  const index = lines[0].split(";").indexOf("boule_1");
  const cells = lines[1].split(";");
  cells[index] = "99";
  lines[1] = cells.join(";");
  await writeFile(path, zipSync({ [entries[0].name]: strToU8(lines.join("\n")) }));
  const result = normalize(dir);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /out of range/);
  assert.deepEqual(await snapshot(dir), before);
});

test("normalization publishes matching master, validation and statistics together", async t => {
  const dir = await workspace(t);
  await rm(join(dir, "data/processed"), { recursive: true });
  const result = normalize(dir);
  assert.equal(result.status, 0, result.stderr);
  const master = JSON.parse(await readFile(join(dir, "data/processed/loto-master.json"), "utf8"));
  const validation = JSON.parse(await readFile(join(dir, "data/processed/validation-report.json"), "utf8"));
  const stats = JSON.parse(await readFile(join(dir, "data/processed/stats-summary.json"), "utf8"));
  assert.equal(validation.errors, 0);
  assert.equal(validation.draws, master.length);
  assert.equal(stats.totalDraws, master.length);
  const expectedKeys = new Set<string>();
  for (const archive of FALLBACK_ARCHIVES) {
    for (const entry of extractCsvEntries(await readFile(join(dir, `data/raw/archives/${archive.id}.zip`)))) {
      for (const row of parseFdjCsv(entry.text)) {
        const draw = normalizeFdjRow(row, archive.id, entry.name);
        expectedKeys.add(`${draw.date}|${draw.drawId}`);
      }
    }
  }
  assert.deepEqual(new Set(master.map((draw: { date: string; drawId: string }) => `${draw.date}|${draw.drawId}`)), expectedKeys);
});
