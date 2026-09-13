import { createHash } from "node:crypto";
import { unzipSync } from "fflate";

export const ARCHIVE_LIMITS = {
  maxZipBytes: 5 * 1024 * 1024,
  maxEntries: 50,
  maxEntryUncompressedBytes: 10 * 1024 * 1024,
  maxTotalUncompressedBytes: 25 * 1024 * 1024
} as const;

const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_EMPTY = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;

export interface ZipEntryInfo {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface ZipInspection {
  entries: ZipEntryInfo[];
  totalUncompressedBytes: number;
}

export interface SafeZipEntry {
  name: string;
  data: Buffer;
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function assertOfficialFdjArchiveUrl(value: string): void {
  const url = new URL(value);
  const allowedHosts = new Set(["www.sto.api.fdj.fr", "sto.api.fdj.fr"]);

  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new Error(`Refusing non-official FDJ archive URL: ${value}`);
  }

  if (!url.pathname.startsWith("/anonymous/service-draw-info/v3/documentations/")) {
    throw new Error(`Unexpected FDJ archive path: ${url.pathname}`);
  }
}

function isSafeEntryName(name: string): boolean {
  if (!name || name.includes("\0")) return false;
  if (name.startsWith("/") || name.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(name)) return false;

  const normalized = name.replaceAll("\\", "/");
  return !normalized.split("/").some((part) => part === "..");
}

function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (offset >= 0 && buffer.readUInt32LE(offset) === ZIP_EOCD) return offset;
  }
  throw new Error("Invalid ZIP: end-of-central-directory record not found");
}

export function inspectZip(buffer: Buffer): ZipInspection {
  if (buffer.length < 4) throw new Error("Invalid ZIP: file is too short");
  if (buffer.length > ARCHIVE_LIMITS.maxZipBytes) {
    throw new Error(`ZIP exceeds compressed size limit (${buffer.length} bytes)`);
  }

  const signature = buffer.readUInt32LE(0);
  if (signature !== ZIP_LOCAL_FILE && signature !== ZIP_EMPTY) {
    throw new Error("Invalid ZIP signature");
  }

  const eocd = findEocd(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);

  if (buffer.readUInt16LE(eocd + 4) !== 0 || buffer.readUInt16LE(eocd + 6) !== 0 ||
      buffer.readUInt16LE(eocd + 8) !== entryCount || entryCount === 0xffff ||
      centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff ||
      (eocd >= 20 && buffer.readUInt32LE(eocd - 20) === 0x07064b50)) {
    throw new Error("Unsupported ZIP directory: multi-disk, ZIP64 or inconsistent counts");
  }

  if (entryCount > ARCHIVE_LIMITS.maxEntries) {
    throw new Error(`ZIP contains too many entries (${entryCount})`);
  }

  if (centralDirectoryOffset + centralDirectorySize !== eocd) {
    throw new Error("Invalid ZIP central directory bounds");
  }

  const entries: ZipEntryInfo[] = [];
  let offset = centralDirectoryOffset;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== ZIP_CENTRAL) {
      throw new Error(`Invalid ZIP central directory entry at index ${index}`);
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > buffer.length) throw new Error("Invalid ZIP filename bounds");
    const name = buffer.subarray(nameStart, nameEnd).toString("utf8");

    if ((flags & 0x1) !== 0) throw new Error(`Encrypted ZIP entry is not allowed: ${name}`);
    if (!isSafeEntryName(name)) throw new Error(`Unsafe ZIP entry path: ${name}`);
    if (uncompressedBytes > ARCHIVE_LIMITS.maxEntryUncompressedBytes) {
      throw new Error(`ZIP entry exceeds uncompressed size limit: ${name}`);
    }

    totalUncompressedBytes += uncompressedBytes;
    if (totalUncompressedBytes > ARCHIVE_LIMITS.maxTotalUncompressedBytes) {
      throw new Error("ZIP exceeds total uncompressed size limit");
    }

    if (entries.some(entry => entry.name === name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    entries.push({ name, compressedBytes, uncompressedBytes });
    offset = nameEnd + extraLength + commentLength;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) throw new Error("Invalid ZIP directory size");
  return { entries, totalUncompressedBytes };
}

export function validateDownloadedArchive(
  requestedUrl: string,
  finalUrl: string,
  contentType: string | null,
  buffer: Buffer
): ZipInspection {
  assertOfficialFdjArchiveUrl(requestedUrl);

  const final = new URL(finalUrl);
  if (final.protocol !== "https:" || !final.hostname.endsWith(".fdj.fr")) {
    throw new Error(`Unexpected final archive host after redirect: ${finalUrl}`);
  }

  const normalizedType = (contentType ?? "").toLowerCase();
  if (
    normalizedType &&
    !normalizedType.includes("zip") &&
    !normalizedType.includes("octet-stream")
  ) {
    throw new Error(`Unexpected FDJ archive Content-Type: ${contentType}`);
  }

  return inspectZip(buffer);
}

export function extractSafeZipEntries(buffer: Buffer): SafeZipEntry[] {
  const inspection = inspectZip(buffer);
  const expected = new Map(inspection.entries.map((entry) => [entry.name, entry]));
  const unpacked = unzipSync(new Uint8Array(buffer), {
    filter: entry => {
      const metadata = expected.get(entry.name);
      if (!metadata || entry.originalSize !== metadata.uncompressedBytes || entry.size !== metadata.compressedBytes) {
        throw new Error(`ZIP entry metadata mismatch: ${entry.name}`);
      }
      return true;
    }
  });

  const output: SafeZipEntry[] = [];
  let actualTotal = 0;

  for (const [name, value] of Object.entries(unpacked)) {
    if (!isSafeEntryName(name)) throw new Error(`Unsafe ZIP entry path: ${name}`);

    const metadata = expected.get(name);
    if (!metadata) throw new Error(`ZIP entry missing from central directory: ${name}`);

    const data = Buffer.from(value);
    if (data.length !== metadata.uncompressedBytes) {
      throw new Error(`ZIP entry size mismatch for ${name}`);
    }

    actualTotal += data.length;
    if (actualTotal > ARCHIVE_LIMITS.maxTotalUncompressedBytes) {
      throw new Error("ZIP exceeds total decompressed size limit");
    }

    output.push({ name, data });
  }

  return output;
}
