import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { downloadArchiveWithMetadata, resolveArchives } from "../src/fdj.js";
import { inspectZip, sha256 } from "../src/archive-security.js";
import { writeJson } from "../src/io.js";

const RAW_DIR = "data/raw/archives";
const MANIFEST_PATH = "data/raw/archive-manifest.json";

interface ManifestArchive {
  id: string;
  label: string;
  url: string;
  order: number;
  file: string;
  bytes: number;
  sha256: string;
  contentType: string | null;
  finalUrl: string;
  csvEntries: string[];
  downloadedAt: string;
}

async function atomicWrite(path: string, buffer: Buffer): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, buffer, { flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function readPreviousManifest(): Promise<{ archives?: ManifestArchive[] }> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as { archives?: ManifestArchive[] };
  } catch {
    return {};
  }
}

async function main() {
  const latestOnly = process.argv.includes("--latest");
  const archives = await resolveArchives();
  const selected = latestOnly
    ? archives.filter((archive) => archive.id === "2019-present")
    : archives;

  await mkdir(RAW_DIR, { recursive: true });

  const downloaded: ManifestArchive[] = [];

  for (const archive of selected) {
    console.log(`Downloading ${archive.label}...`);

    const result = await downloadArchiveWithMetadata(archive.url);
    const inspection = inspectZip(result.buffer);
    const csvEntries = inspection.entries
      .map((entry) => entry.name)
      .filter((name) => name.toLowerCase().endsWith(".csv"));

    if (!csvEntries.length) {
      throw new Error(`FDJ archive contains no CSV: ${archive.id}`);
    }

    const path = `${RAW_DIR}/${archive.id}.zip`;
    await atomicWrite(path, result.buffer);

    const manifestEntry: ManifestArchive = {
      ...archive,
      file: path,
      bytes: result.buffer.length,
      sha256: sha256(result.buffer),
      contentType: result.contentType,
      finalUrl: result.finalUrl,
      csvEntries,
      downloadedAt: new Date().toISOString()
    };

    downloaded.push(manifestEntry);
    console.log(`  -> ${path} (${manifestEntry.bytes} bytes, sha256 ${manifestEntry.sha256.slice(0, 12)}…)`);
  }

  const previous = await readPreviousManifest();
  const byId = new Map((previous.archives ?? []).map((entry) => [entry.id, entry]));
  for (const entry of downloaded) byId.set(entry.id, entry);

  const manifestArchives = archives
    .map((archive) => byId.get(archive.id))
    .filter((entry): entry is ManifestArchive => Boolean(entry));

  await writeJson(MANIFEST_PATH, {
    schemaVersion: 1,
    source: "FDJ",
    historyPage: "https://www.fdj.fr/jeux-de-tirage/loto/historique",
    generatedAt: new Date().toISOString(),
    archives: manifestArchives
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
