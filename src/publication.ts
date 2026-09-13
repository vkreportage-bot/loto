import { existsSync, mkdirSync, linkSync, readFileSync, writeFileSync, unlinkSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

/** Publish a complete directory, retaining the previous generation until the swap succeeds.
 * A killed process is recovered by the next invocation. There can be a brief ENOENT
 * between the two directory renames, but never a directory containing mixed generations.
 */
export async function publishDirectory(target: string, prepare: (staging: string) => Promise<void>): Promise<void> {
  mkdirSync(dirname(target), { recursive: true });
  const lock = `${target}.lock`;
  const staging = `${target}.next`;
  const previous = `${target}.previous`;

  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Invalid publication lock; inspect ${lock}`);
    try {
      process.kill(pid, 0);
      throw new Error(`Publication already running (PID ${pid})`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    unlinkSync(lock);
  }
  // Link a complete PID file atomically, so a killed writer never leaves an empty lock.
  const candidate = `${lock}.${randomUUID()}`;
  try {
    writeFileSync(candidate, String(process.pid), { flag: "wx" });
    linkSync(candidate, lock);
  } finally {
    if (existsSync(candidate)) unlinkSync(candidate);
  }

  try {
    // Recover a process interrupted after moving the old generation aside.
    if (existsSync(previous)) {
      if (!existsSync(target)) renameSync(previous, target);
      else rmSync(previous, { recursive: true });
    }
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging);
    await prepare(staging);

    if (existsSync(target)) renameSync(target, previous);
    try {
      renameSync(staging, target);
    } catch (error) {
      if (existsSync(previous)) renameSync(previous, target);
      throw error;
    }
    rmSync(previous, { recursive: true, force: true });
  } finally {
    rmSync(staging, { recursive: true, force: true });
    unlinkSync(lock);
  }
}
