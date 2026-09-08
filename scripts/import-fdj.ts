import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolveArchives, downloadArchive } from "../src/fdj.js";
import { writeJson } from "../src/io.js";

const RAW_DIR = "data/raw/archives";
const MANIFEST_PATH = "data/raw/archive-manifest.json";

async function main() {
  const latestOnly = process.argv.includes("--latest");
  const archives = await resolveArchives();
  const selected = latestOnly ? archives.filter((archive) => archive.id === "2019-present") : archives;

  await mkdir(RAW_DIR, { recursive: true });

  const manifest = [];
  for (const archive of selected) {
    console.log(`Downloading ${archive.label}...`);
    const buffer = await downloadArchive(archive.url);
    const path = `${RAW_DIR}/${archive.id}.zip`;
    await writeFile(path, buffer);
    manifest.push({
      ...archive,
      file: path,
      bytes: buffer.length,
      downloadedAt: new Date().toISOString()
    });
    console.log(`  -> ${path} (${buffer.length} bytes)`);
  }

  if (!latestOnly) {
    await writeJson(MANIFEST_PATH, {
      source: "FDJ",
      historyPage: "https://www.fdj.fr/jeux-de-tirage/loto/historique",
      generatedAt: new Date().toISOString(),
      archives: manifest
    });
  } else {
    let previous: { archives?: Array<Record<string, unknown>> } = {};
    try {
      previous = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as typeof previous;
    } catch {
      // Le premier import complet créera le manifeste s'il n'existe pas encore.
    }

    const latest = manifest[0];
    const archives = (previous.archives ?? []).filter((entry) => entry.id !== latest?.id);
    if (latest) archives.push(latest);

    await writeJson(MANIFEST_PATH, {
      source: "FDJ",
      historyPage: "https://www.fdj.fr/jeux-de-tirage/loto/historique",
      generatedAt: new Date().toISOString(),
      archives
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
